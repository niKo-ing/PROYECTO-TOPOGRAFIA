import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ControlGeometricoDashboard } from "@/features/control-geometrico/components/ControlGeometricoDashboard";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";

export default async function ControlGeometricoPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (!session) redirect("/login");

  const email = session.email;
  const name = email.split("@")[0] || "Usuario";

  return <ControlGeometricoDashboard user={{ name, email, role: "Administrador" }} />;
}
