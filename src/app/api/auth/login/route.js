import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import { setSessionCookie } from "@/shared/lib/auth/session";
import { isProd } from "@/shared/lib/env";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("app_users")
      .select("email,password_hash")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: "Error validando credenciales",
          details: isProd() ? undefined : { message: error.message, code: error.code },
        },
        { status: 500 },
      );
    }
    if (!user?.password_hash) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true }, { status: 200 });
    setSessionCookie(response, { email: user.email });
    return response;
  } catch {
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
