import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import { coordinatesToCsv } from "@/shared/lib/csv/toCsv";
import { isProd } from "@/shared/lib/env";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resolvedParams = await params;
  const paramId = resolvedParams?.documentId;
  const documentId =
    String(paramId ?? "").trim() ||
    String(request.nextUrl.searchParams.get("documentId") ?? "").trim() ||
    parseDocumentIdFromPath(request.nextUrl.pathname);
  if (!documentId || documentId === "undefined" || documentId === "null") {
    return NextResponse.json({ error: "documentId requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("coordinates")
    .select("punto,norte,este,cota_z,descripcion")
    .eq("document_id", documentId)
    .eq("user_email", session.email)
    .order("id", { ascending: true });

  if (error) {
    console.error("ERROR CSV:", error);
    return NextResponse.json(
      {
        error: "Error generando CSV",
        details: isProd() ? undefined : { message: error.message, code: error.code },
      },
      { status: 500 },
    );
  }

  const csv = coordinatesToCsv(rows ?? []);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="coordenadas-${documentId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function parseDocumentIdFromPath(pathname) {
  const m = String(pathname ?? "").match(/^\/api\/documents\/([^/]+)\/csv\/?$/i);
  return m?.[1] ? decodeURIComponent(m[1]) : "";
}
