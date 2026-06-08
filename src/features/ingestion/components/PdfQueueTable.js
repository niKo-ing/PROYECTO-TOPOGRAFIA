"use client";

import { RefreshCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/ui/Button";

export function PdfQueueTable({ items, onRetry }) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-600">
          <tr>
            <th className="px-4 py-3 font-semibold">Archivo</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Detalle</th>
            <th className="px-4 py-3 font-semibold">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {items.map((it) => (
            <tr key={it.id} className="align-top">
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-900">{it.name}</span>
                  <span className="text-xs text-zinc-500">{formatBytes(it.size)}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={it.status} />
              </td>
              <td className="px-4 py-3">
                {it.status === "completed" ? (
                  <CompletedDetail result={it.result} />
                ) : it.status === "error" ? (
                  <div className="flex items-start gap-2 text-red-700">
                    <TriangleAlert className="mt-0.5 h-4 w-4" />
                    <span className="text-sm">{it.message || "Error"}</span>
                  </div>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {it.status === "error" ? (
                  <Button
                    onClick={() => onRetry(it.id)}
                    className="bg-zinc-900 hover:bg-zinc-800"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reintentar
                  </Button>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompletedDetail({ result }) {
  const docId = result?.documentId ?? "—";
  const rows = typeof result?.rowsInserted === "number" ? result.rowsInserted : "—";
  return (
    <div className="flex flex-col">
      <span className="text-sm text-zinc-900">Documento: {docId}</span>
      <span className="text-xs text-zinc-500">Filas guardadas: {rows}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-zinc-900">Sin archivos</p>
      <p className="mt-1 text-sm text-zinc-600">
        Agrega PDFs para iniciar el procesamiento.
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const style = {
    queued: "bg-zinc-100 text-zinc-800",
    processing: "bg-blue-100 text-blue-800",
    completed: "bg-emerald-100 text-emerald-800",
    error: "bg-red-100 text-red-800",
  }[status];

  const label = {
    queued: "En cola",
    processing: "Procesando",
    completed: "Completado",
    error: "Error",
  }[status];

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

