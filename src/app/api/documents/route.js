import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request) {
  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)));

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents")
    .select("id,filename,status,rows_count,created_at,error_message")
    .eq("user_email", session.email)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("ERROR DOCUMENTS:", error);
    return NextResponse.json({ error: "Error listando documentos" }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] }, { status: 200 });
}

