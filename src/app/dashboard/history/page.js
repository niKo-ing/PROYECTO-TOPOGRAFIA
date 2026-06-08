import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";
import { GeoExtractDashboard } from "@/features/dashboard/components/GeoExtractDashboard";

export default async function DashboardHistoryPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (!session) redirect("/login");

  const email = session.email;
  const name = email.split("@")[0] || "Usuario";
  return <GeoExtractDashboard user={{ name, email, role: "Administrador" }} view="history" />;
}
