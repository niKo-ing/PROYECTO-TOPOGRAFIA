"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  RefreshCcw,
  Settings,
  Shield,
  Satellite,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/ui/Button";
import { usePdfQueue } from "@/features/ingestion/hooks/usePdfQueue";
import { useDocuments } from "@/features/dashboard/hooks/useDocuments";

const GEMINI_MODEL_UI =
  String(process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "").trim() || "Gemini 3.1 Flash Lite";

export function GeoExtractDashboard({ user, view = "main" }) {
  const isHistory = view === "history";
  const pathname = usePathname();
  const router = useRouter();
  const queue = usePdfQueue({ maxFiles: 500, concurrency: 1 });
  const docs = useDocuments({ limit: 20 });
  const [csvError, setCsvError] = useState("");

  const stats = useMemo(() => {
    return docs.stats;
  }, [docs.stats]);

  const refreshKey = useMemo(() => {
    const completedIds = queue.items
      .filter((i) => i.status === "completed" && i.result?.documentId)
      .map((i) => i.result.documentId)
      .join(",");
    return `${queue.items.length}:${completedIds}`;
  }, [queue.items]);
  const lastRefreshKeyRef = useRef("");
  useEffect(() => {
    if (lastRefreshKeyRef.current === refreshKey) return;
    lastRefreshKeyRef.current = refreshKey;
    if (!refreshKey) return;
    docs.refresh();
  }, [docs, refreshKey]);

  async function onLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  async function downloadCsv({ documentId, filename }) {
    setCsvError("");
    const docId = String(documentId ?? "").trim();
    if (!docId || docId === "undefined" || docId === "null") {
      const errMsg = "No se pudo descargar el CSV: falta documentId del documento.";
      setCsvError(errMsg);
      throw new Error(errMsg);
    }
    const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/csv`, {
      method: "GET",
    });
    if (!res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text().catch(() => "");
      const message =
        typeof payload === "string"
          ? payload
          : payload?.error || payload?.message || JSON.stringify(payload);
      const errMsg = `No se pudo descargar el CSV (HTTP ${res.status}). ${message || ""}`.trim();
      setCsvError(errMsg);
      throw new Error(errMsg);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
              Topografía corporativa
            </span>
          </div>
        </div>

        <nav className="px-3">
          <SidebarLink
            href="/dashboard"
            icon={LayoutDashboard}
            label="Panel Principal"
            active={pathname === "/dashboard"}
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
            label="Configuración"
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
                  {user?.email ?? "—"}
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
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="border-b border-slate-200/70 bg-white px-4 py-4 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div className="flex flex-col">
              <h1 className="text-base font-semibold">
                {isHistory ? "Historial de Documentos" : "Panel Principal"}
              </h1>
              <p className="text-sm text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
                {isHistory
                  ? "Revisa, descarga CSV o elimina documentos procesados."
                  : "Carga PDFs, procesa con Gemini y exporta a CSV."}
              </p>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-900/40 dark:text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Operacional / {GEMINI_MODEL_UI}
              </span>
            </div>
          </div>
        </header>

        <div
          className={[
            isHistory ? "flex w-full flex-1 flex-col gap-6 px-4 py-6" : "mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6",
          ].join(" ")}
        >
          {isHistory ? null : (
            <section className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <DropzoneCard
                  disabled={queue.items.length >= 500}
                  onFiles={(files) => queue.enqueueFiles(files)}
                  fileCount={queue.items.length}
                  onProcess={() => queue.start()}
                />
              </div>

              <div className="grid gap-4 lg:col-span-5 sm:grid-cols-3 lg:grid-cols-1">
                <StatCard
                  title="Total de PDFs Procesados"
                  value={String(stats.totalPdfs)}
                />
                <StatCard
                  title="Coordenadas Extraídas"
                  value={String(stats.totalCoords)}
                />
                <SystemCard />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200/70 bg-white transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-5 py-4 transition-colors duration-300 dark:border-slate-700/50">
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold">Actividad Reciente</h2>
                <p className="text-xs text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
                  Últimos documentos procesados (Supabase).
                </p>
              </div>
              <button
                type="button"
                onClick={() => docs.refresh()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors duration-300 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/40"
              >
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </button>
            </div>

            {csvError ? (
              <div className="px-5 pt-4">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition-colors duration-300 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {csvError}
                </div>
              </div>
            ) : null}

            {docs.error ? (
              <div className="px-5 pt-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors duration-300 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  {docs.error}
                </div>
              </div>
            ) : null}

            <RecentTable
              items={docs.documents}
              onDelete={(id) => docs.remove(id)}
              onDownload={downloadCsv}
            />
          </section>
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

function DropzoneCard({ disabled, onFiles, onProcess, fileCount }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold">Zona de carga</h2>
          <p className="text-xs text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
            Arrastra y suelta o examina PDFs con tablas de coordenadas.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors duration-300 dark:bg-slate-900/40 dark:text-slate-200">
          {fileCount}/500
        </span>
      </div>

      <PdfDropArea disabled={disabled} onFiles={onFiles} />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
          Solo archivos PDF con tablas de coordenadas
        </p>
        <Button
          onClick={onProcess}
          disabled={fileCount === 0}
          className="bg-blue-600 hover:bg-blue-500 focus:ring-blue-400"
        >
          <Sparkles className="h-4 w-4" />
          Procesar con IA
        </Button>
      </div>
    </div>
  );
}

function PdfDropArea({ disabled, onFiles }) {
  return (
    <label className="mt-5 block">
      <input
        type="file"
        accept="application/pdf,.pdf"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (!e.target.files?.length) return;
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className={[
          "group rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-300",
          "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40",
          "dark:border-slate-700/50 dark:bg-slate-900/40 dark:hover:border-blue-400/70 dark:hover:bg-blue-500/10",
          disabled ? "opacity-60" : "cursor-pointer",
        ].join(" ")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled) return;
          const files = e.dataTransfer?.files;
          if (files?.length) onFiles(files);
        }}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm transition-colors duration-300 dark:bg-slate-800">
          <FileText className="h-6 w-6 text-slate-700 transition-colors duration-300 dark:text-slate-200" />
        </div>
        <p className="mt-4 text-sm font-semibold">
          Arrastra tus documentos topográficos aquí o haz clic para examinar
        </p>
        <p className="mt-1 text-xs text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
          Procesamiento secuencial para evitar límites de serverless.
        </p>
      </div>
    </label>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
      <p className="text-xs font-semibold text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function SystemCard() {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
      <p className="text-xs font-semibold text-slate-600 transition-colors duration-300 dark:text-slate-300/80">
        Estado del Sistema
      </p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600/10 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors duration-300 dark:text-emerald-200">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Operacional / {GEMINI_MODEL_UI}
      </div>
    </div>
  );
}

function RecentTable({ items, onDelete, onDownload }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600 transition-colors duration-300 dark:bg-slate-900/40 dark:text-slate-300/80">
          <tr>
            <th className="px-5 py-3 font-semibold">Nombre del Archivo</th>
            <th className="px-5 py-3 font-semibold">Fecha de Carga</th>
            <th className="px-5 py-3 font-semibold">Filas Extraídas</th>
            <th className="px-5 py-3 font-semibold">Estado</th>
            <th className="sticky right-0 z-10 px-5 py-3 text-right font-semibold bg-slate-50 dark:bg-slate-900/40">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 transition-colors duration-300 dark:divide-slate-700/50">
          {items.length === 0 ? (
            <tr>
              <td
                className="px-5 py-8 text-slate-600 transition-colors duration-300 dark:text-slate-300/80"
                colSpan={5}
              >
                Sin actividad todavía. Sube tu primer PDF.
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="px-5 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold">{it.filename}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-700 transition-colors duration-300 dark:text-slate-200">
                  {formatDateTime(it.created_at)}
                </td>
                <td className="px-5 py-4 text-slate-700 transition-colors duration-300 dark:text-slate-200">
                  {it.status === "completed" ? String(it.rows_count ?? "—") : "—"}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={it.status} />
                    {it.status === "error" && it.error_message ? (
                      <span className="text-xs text-red-700 transition-colors duration-300 dark:text-red-200">
                        <span className="inline-flex items-center gap-1">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          {it.error_message}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="sticky right-0 px-5 py-4 text-right bg-white border-l border-slate-200/70 transition-colors duration-300 dark:bg-slate-800 dark:border-slate-700/50">
                  <div className="flex flex-wrap items-center justify-end gap-2 whitespace-nowrap">
                    {it.status === "completed" ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const documentId = it.id;
                          const safeName = String(it.filename ?? "coordenadas.pdf")
                            .replace(/\.pdf$/i, "")
                            .replaceAll(/[^\w.-]/g, "_");
                          await onDownload({
                            documentId,
                            filename: `${safeName || "coordenadas"}-${documentId}.csv`,
                          });
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors duration-300 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/40"
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden md:inline">Descargar CSV</span>
                      </button>
                    ) : (
                      <span className="text-slate-500 transition-colors duration-300 dark:text-slate-300/60">
                        —
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onDelete(it.id)}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-900 transition-colors duration-300 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/40"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-300";
  if (status === "completed") {
    return <span className={`${base} bg-emerald-600/10 text-emerald-700 dark:text-emerald-200`}>Completado</span>;
  }
  if (status === "processing") {
    return <span className={`${base} bg-amber-500/15 text-amber-800 dark:text-amber-200`}>Procesando</span>;
  }
  if (status === "error") {
    return <span className={`${base} bg-red-600/10 text-red-700 dark:text-red-200`}>Error</span>;
  }
  return <span className={`${base} bg-slate-200/70 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200`}>En cola</span>;
}

function formatDateTime(ts) {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}
