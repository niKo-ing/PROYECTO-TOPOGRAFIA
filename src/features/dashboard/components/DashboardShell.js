"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Axis3D,
  FileScan,
  History,
  LogOut,
  Satellite,
  Settings,
  Shield,
} from "lucide-react";

const MODEL_LABEL =
  String(process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "").trim() || "Gemini 3.1 Flash Lite";

export function DashboardShell({ user, title, description, children, maxWidth = "max-w-7xl" }) {
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-0px)] w-full bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-900 dark:text-white">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200/70 bg-white transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Satellite className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">GeoExtract Pro</span>
            <span className="text-xs text-slate-500 dark:text-slate-300/80">
              Topografia corporativa
            </span>
          </div>
        </div>

        <nav className="px-3">
          <SidebarLink
            href="/dashboard"
            icon={FileScan}
            label="Extraccion PDF"
            active={pathname === "/dashboard"}
          />
          <SidebarLink
            href="/dashboard/control-geometrico"
            icon={Axis3D}
            label="Control Geometrico"
            active={pathname === "/dashboard/control-geometrico"}
          />
          <SidebarLink
            href="/dashboard/history"
            icon={History}
            label="Historial de PDFs"
            active={pathname === "/dashboard/history"}
          />
          <SidebarLink
            href="/dashboard/settings"
            icon={Settings}
            label="Configuracion"
            active={pathname === "/dashboard/settings"}
          />
        </nav>

        <div className="mt-auto px-4 pb-5">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors duration-300 dark:bg-white dark:text-slate-900">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{user?.name ?? "Usuario"}</span>
                <span className="truncate text-xs text-slate-600 dark:text-slate-300/80">
                  {user?.email ?? "-"}
                </span>
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-blue-600/10 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors duration-300 dark:text-blue-200">
                  <Shield className="h-3 w-3" />
                  {user?.role ?? "Administrador"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors duration-300 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/40"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesion
            </button>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="border-b border-slate-200/70 bg-white px-4 py-4 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div className="flex flex-col">
              <h1 className="text-base font-semibold">{title}</h1>
              <p className="text-sm text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
                {description}
              </p>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-900/40 dark:text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Operacional / {MODEL_LABEL}
              </span>
            </div>
          </div>
        </header>

        <div className={`mx-auto flex w-full ${maxWidth} flex-1 flex-col gap-6 px-4 py-6`}>
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ href, icon: Icon, label, active }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-300",
        active
          ? "bg-blue-600 text-white"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/40",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
