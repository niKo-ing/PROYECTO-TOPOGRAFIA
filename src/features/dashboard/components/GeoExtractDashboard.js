"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  RefreshCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/ui/Button";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";
import { usePdfQueue } from "@/features/ingestion/hooks/usePdfQueue";
import { useDocuments } from "@/features/dashboard/hooks/useDocuments";

const GEMINI_MODEL_UI =
  String(process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "").trim() || "Gemini 3.1 Flash Lite";

export function GeoExtractDashboard({ user, view = "main" }) {
  const isHistory = view === "history";
  const queue = usePdfQueue({ maxFiles: 500, concurrency: 1 });
  const docs = useDocuments({ limit: 20 });
  const { refresh } = docs;
  const [csvError, setCsvError] = useState("");

  const stats = useMemo(() => {
    return docs.stats;
  }, [docs.stats]);

  const recentItems = useMemo(() => {
    const serverDocs = Array.isArray(docs.documents) ? docs.documents : [];
    if (isHistory) return serverDocs;

    const byId = new Map(serverDocs.map((d) => [String(d.id), d]));
    const merged = [...serverDocs];

    for (const it of queue.items) {
      const qStatus = String(it?.status ?? "");

      if (qStatus === "completed" && it?.result?.documentId) {
        const id = String(it.result.documentId);
        if (!byId.has(id)) {
          merged.push({
            id,
            filename: it.name,
            status: "completed",
            rows_count: it.result?.rowsInserted ?? null,
            created_at: toIsoDate(it.finishedAt ?? it.startedAt ?? it.addedAt),
            error_message: "",
          });
        }
        continue;
      }

      merged.push({
        id: `local-${it.id}`,
        filename: it.name,
        status: qStatus,
        rows_count: null,
        created_at: toIsoDate(it.startedAt ?? it.addedAt),
        error_message: it.message ?? "",
      });
    }

    return merged;
  }, [docs.documents, isHistory, queue.items]);

  const refreshKey = useMemo(() => {
    const processingCount = queue.items.filter((i) => i.status === "processing").length;
    const completedIds = queue.items
      .filter((i) => i.status === "completed" && i.result?.documentId)
      .map((i) => i.result.documentId)
      .join(",");
    return `${queue.items.length}:${processingCount}:${completedIds}`;
  }, [queue.items]);
  const lastRefreshKeyRef = useRef("");
  useEffect(() => {
    if (lastRefreshKeyRef.current === refreshKey) return;
    lastRefreshKeyRef.current = refreshKey;
    if (!refreshKey) return;
    refresh();
  }, [refresh, refreshKey]);

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
    <DashboardShell
      user={user}
      title={isHistory ? "Historial de Documentos" : "Extraccion PDF"}
      description={
        isHistory
          ? "Revisa, descarga CSV o elimina documentos procesados."
          : "Carga PDFs, procesa con Gemini y exporta a CSV."
      }
      maxWidth={isHistory ? "" : "max-w-7xl"}
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
                disabled={docs.status === "loading"}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors duration-300 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/40"
              >
                <RefreshCcw className={["h-4 w-4", docs.status === "loading" ? "animate-spin" : ""].join(" ")} />
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
              items={recentItems}
              onDelete={(id) => docs.remove(id)}
              onDownload={downloadCsv}
            />
          </section>
    </DashboardShell>
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
  const [isDragging, setIsDragging] = useState(false);

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
          "group rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
          isDragging
            ? "border-blue-500 bg-blue-600/10 scale-[1.01]"
            : [
                "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40",
                "dark:border-slate-700/50 dark:bg-slate-900/40 dark:hover:border-blue-400/70 dark:hover:bg-blue-500/10",
              ].join(" "),
          disabled ? "opacity-60" : "cursor-pointer",
        ].join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled) return;
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled) return;
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
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
  const sortedItems = useMemo(() => {
    return [...(items ?? [])].sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [items]);

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
          {sortedItems.length === 0 ? (
            <tr>
              <td
                className="px-5 py-8 text-slate-600 transition-colors duration-300 dark:text-slate-300/80"
                colSpan={5}
              >
                Sin actividad todavía. Sube tu primer PDF.
              </td>
            </tr>
          ) : (
            sortedItems.map((it) => (
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
                    {it.status === "completed" && !String(it.id).startsWith("local-") ? (
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

                    {String(it.id).startsWith("local-") ? null : (
                      <button
                        type="button"
                        onClick={() => onDelete(it.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-900 transition-colors duration-300 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/40"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
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
    return (
      <span className={`${base} gap-1 bg-emerald-600/10 text-emerald-700 dark:text-emerald-200`}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Completado
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className={`${base} gap-1 bg-amber-500/15 text-amber-800 dark:text-amber-200`}>
        <Clock3 className="h-3.5 w-3.5" />
        Procesando
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={`${base} gap-1 bg-red-600/10 text-red-700 dark:text-red-200`}>
        <XCircle className="h-3.5 w-3.5" />
        Error
      </span>
    );
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

function toIsoDate(value) {
  if (!value) return "";
  return new Date(value).toISOString();
}
