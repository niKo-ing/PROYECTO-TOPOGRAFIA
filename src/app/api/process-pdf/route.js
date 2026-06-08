import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import { extractCoordenadasFromPdf } from "@/shared/lib/gemini/extractCoordenadas";
import { coordinatesToCsv } from "@/shared/lib/csv/toCsv";
import { sendCoordinatesCsvEmail } from "@/shared/lib/email/resend";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[process-pdf] Request received", {
      method: request.method,
      contentType: request.headers.get("content-type"),
    });
  }

  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const documentId = crypto.randomUUID();

  let filename = "documento.pdf";
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (process.env.NODE_ENV !== "production") {
      console.log("[process-pdf] Archivo recibido:", file);
      console.log("[process-pdf] file meta:", {
        name: file && typeof file === "object" ? file.name : null,
        type: file && typeof file === "object" ? file.type : null,
        size: file && typeof file === "object" ? file.size : null,
      });
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "PDF requerido (field: file)" }, { status: 400 });
    }

    filename = file.name || filename;
    if (file.type !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 });
    }

    const maxBytes = 20 * 1024 * 1024;
    if (typeof file.size === "number" && file.size > maxBytes) {
      return NextResponse.json({ error: "PDF demasiado grande (máx 20MB)" }, { status: 413 });
    }

    const { error: docInsertError } = await supabase.from("documents").insert({
      id: documentId,
      user_email: session.email,
      filename,
      status: "processing",
    });
    if (docInsertError) {
      return NextResponse.json({ error: "Error creando documento" }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength <= 0) {
      await supabase
        .from("documents")
        .update({ status: "error", error_message: "El PDF está vacío" })
        .eq("id", documentId);
      return NextResponse.json({ error: "El PDF está vacío" }, { status: 422 });
    }

    const pdfBuffer = Buffer.from(new Uint8Array(arrayBuffer));
    const pdfBase64 = pdfBuffer.toString("base64");
    const rows = await extractCoordenadasFromPdf({ pdfBase64 });

    const rowsToInsert = rows.map((r) => ({
      document_id: documentId,
      user_email: session.email,
      punto: r.punto,
      norte: r.norte,
      este: r.este,
      cota_z: r.cota_z,
      descripcion: r.descripcion,
    }));

    const { error: coordsError } = await supabase.from("coordinates").insert(rowsToInsert);
    if (coordsError) {
      await supabase
        .from("documents")
        .update({ status: "error", error_message: "Error guardando coordenadas" })
        .eq("id", documentId);
      return NextResponse.json({ error: "Error guardando coordenadas" }, { status: 500 });
    }

    const csv = coordinatesToCsv(rows);
    const safeBaseName = filename.replace(/\.pdf$/i, "").replaceAll(/[^\w.-]/g, "_");
    const csvFilename = `${safeBaseName || "coordenadas"}-${documentId}.csv`;

    await sendCoordinatesCsvEmail({
      to: "nic.estefania@duocuc.cl",
      subject: "CSV de coordenadas listo para Civil 3D",
      text: `Adjunto encontrarás el CSV generado desde el PDF "${filename}". Documento: ${documentId}`,
      filename: csvFilename,
      csv,
    });

    await supabase
      .from("documents")
      .update({ status: "completed", rows_count: rows.length })
      .eq("id", documentId);

    return NextResponse.json(
      { ok: true, documentId, rowsInserted: rows.length },
      { status: 200 },
    );
  } catch (err) {
    console.error("ERROR EN API:", err);
    const quotaInfo = getGeminiQuotaInfo(err);
    await supabase
      .from("documents")
      .update({
        status: "error",
        error_message: quotaInfo?.message ?? (err instanceof Error ? err.message : "Error desconocido"),
      })
      .eq("id", documentId);

    if (quotaInfo) {
      return NextResponse.json(
        { error: quotaInfo.message, retryAfterSeconds: quotaInfo.retryAfterSeconds },
        {
          status: 429,
          headers: quotaInfo.retryAfterSeconds
            ? { "Retry-After": String(quotaInfo.retryAfterSeconds) }
            : undefined,
        },
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error procesando PDF" },
      { status: 500 },
    );
  }
}

function getGeminiQuotaInfo(err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const isQuota =
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("\"code\":429") ||
    msg.includes("code\": 429") ||
    msg.includes("Quota exceeded");

  if (!isQuota) return null;

  const retryAfterSeconds = parseRetryAfterSeconds(msg);
  const retryText = retryAfterSeconds ? ` Reintenta en ${retryAfterSeconds}s.` : "";
  return {
    retryAfterSeconds,
    message: `Cuota/límite de Gemini excedido.${retryText} Verifica tu plan/billing y quotas.`,
  };
}

function parseRetryAfterSeconds(msg) {
  const m1 = msg.match(/retryDelay\"\s*:\s*\"(\d+)s\"/i);
  if (m1?.[1]) return Number(m1[1]);
  const m2 = msg.match(/Please retry in\s+([\d.]+)s/i);
  if (m2?.[1]) return Math.ceil(Number(m2[1]));
  return null;
}
