import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
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

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_email", session.email);

  if (error) {
    console.error("ERROR DELETE DOCUMENT:", error);
    return NextResponse.json({ error: "Error eliminando documento" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function parseDocumentIdFromPath(pathname) {
  const m = String(pathname ?? "").match(/^\/api\/documents\/([^/]+)\/?$/i);
  return m?.[1] ? decodeURIComponent(m[1]) : "";
}
