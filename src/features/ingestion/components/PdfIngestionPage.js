"use client";

import { FileUp, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { PdfDropzone } from "@/features/ingestion/components/PdfDropzone";
import { PdfQueueTable } from "@/features/ingestion/components/PdfQueueTable";
import { usePdfQueue } from "@/features/ingestion/hooks/usePdfQueue";

export function PdfIngestionPage({ userEmail }) {
  const queue = usePdfQueue({ maxFiles: 500, concurrency: 1 });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-zinc-900">Extractor Masivo de Coordenadas</h1>
            <p className="text-sm text-zinc-600">Sesión: {userEmail}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={queue.isRunning ? queue.pause : queue.start}
              className="bg-blue-600 hover:bg-blue-500 focus:ring-blue-400"
              disabled={queue.items.length === 0}
            >
              {queue.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {queue.isRunning ? "Pausar" : "Procesar"}
            </Button>
            <Button
              onClick={queue.clearAll}
              className="bg-zinc-900 hover:bg-zinc-800"
              disabled={queue.items.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <PdfDropzone
          onFiles={(files) => queue.enqueueFiles(files)}
          disabled={queue.items.length >= 500}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="En cola" value={queue.stats.queuedCount} />
          <Stat label="Procesando" value={queue.stats.processingCount} />
          <Stat label="Completados" value={queue.stats.completedCount} />
          <Stat label="Errores" value={queue.stats.errorCount} />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-zinc-700" />
              <h2 className="text-sm font-semibold text-zinc-900">Cola de PDFs</h2>
            </div>
            <p className="text-xs text-zinc-500">
              Envío asíncrono 1x1 al backend para evitar timeouts.
            </p>
          </div>

          <PdfQueueTable items={queue.items} onRetry={queue.retry} />
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

