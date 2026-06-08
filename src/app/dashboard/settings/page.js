import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";

export default async function DashboardSettingsPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (!session) redirect("/login");

  const email = session.email;
  const name = email.split("@")[0] || "Usuario";

  return (
    <DashboardShell
      user={{ name, email, role: "Administrador" }}
      title="Configuracion"
      description="Ajustes generales de la plataforma."
    >
      <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-8 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
        <h1 className="text-lg font-semibold">Configuración</h1>
        <p className="mt-2 text-sm text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
          Próximamente.
        </p>
      </div>
    </DashboardShell>
  );
}
