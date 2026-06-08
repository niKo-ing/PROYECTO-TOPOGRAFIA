"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/ui/Button";

export function PdfDropzone({ onFiles, disabled = false }) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  const openFilePicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (disabled) return;
      setIsOver(false);
      const files = e.dataTransfer?.files;
      if (files?.length) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      className={[
        "rounded-2xl border border-dashed bg-white",
        isOver ? "border-blue-400 ring-2 ring-blue-200" : "border-zinc-200",
        disabled ? "opacity-60" : "",
      ].join(" ")}
      onDragEnter={() => setIsOver(true)}
      onDragLeave={() => setIsOver(false)}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="rounded-full bg-zinc-100 p-3">
          <UploadCloud className="h-6 w-6 text-zinc-700" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-zinc-900">
            Arrastra y suelta hasta 500 PDFs
          </p>
          <p className="text-sm text-zinc-600">
            O selecciona archivos desde tu equipo.
          </p>
        </div>
        <div>
          <Button
            onClick={openFilePicker}
            disabled={disabled}
            className="bg-zinc-900 hover:bg-zinc-800"
          >
            Seleccionar PDFs
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (!e.target.files?.length) return;
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

