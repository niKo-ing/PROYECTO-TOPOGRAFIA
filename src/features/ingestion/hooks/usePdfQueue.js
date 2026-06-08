"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export function usePdfQueue({ maxFiles = 500, concurrency = 1 } = {}) {
  const [items, setItems] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const inFlightRef = useRef(0);
  const loopActiveRef = useRef(false);

  const queuedCount = useMemo(
    () => items.filter((i) => i.status === "queued").length,
    [items],
  );
  const processingCount = useMemo(
    () => items.filter((i) => i.status === "processing").length,
    [items],
  );
  const completedCount = useMemo(
    () => items.filter((i) => i.status === "completed").length,
    [items],
  );
  const errorCount = useMemo(() => items.filter((i) => i.status === "error").length, [items]);

  const enqueueFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList ?? []).filter(
        (f) => f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")),
      );
      if (files.length === 0) return;

      setItems((prev) => {
        const remainingSlots = Math.max(0, maxFiles - prev.length);
        const nextFiles = files.slice(0, remainingSlots);
        const nextItems = nextFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size,
          addedAt: Date.now(),
          startedAt: null,
          finishedAt: null,
          status: "queued",
          message: "",
          result: null,
        }));
        return [...prev, ...nextItems];
      });
    },
    [maxFiles],
  );

  const clearAll = useCallback(() => {
    setItems([]);
    setIsRunning(false);
    isRunningRef.current = false;
    inFlightRef.current = 0;
    loopActiveRef.current = false;
  }, []);

  const retry = useCallback((id) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, status: "queued", message: "", result: null }
          : it,
      ),
    );
  }, []);

  const processOne = useCallback(async (item) => {
    const form = new FormData();
    form.append("file", item.file, item.name);

    const res = await fetch("/api/process-pdf", { method: "POST", body: form });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = data?.error ?? "Error procesando PDF";
      throw new Error(errMsg);
    }
    return data;
  }, []);

  const tick = useCallback(() => {
    if (!loopActiveRef.current) return;

    setItems((prev) => {
      if (!isRunningRef.current) return prev;
      if (inFlightRef.current >= concurrency) return prev;

      const nextIndex = prev.findIndex((it) => it.status === "queued");
      if (nextIndex === -1) {
        if (inFlightRef.current === 0) {
          loopActiveRef.current = false;
          queueMicrotask(() => setIsRunning(false));
        }
        return prev;
      }

      const next = prev[nextIndex];
      const updated = [...prev];
      updated[nextIndex] = { ...next, status: "processing", message: "", startedAt: Date.now() };

      inFlightRef.current += 1;
      queueMicrotask(async () => {
        try {
          const result = await processOne(next);
          setItems((p) =>
            p.map((it) =>
              it.id === next.id
                ? { ...it, status: "completed", result, message: "", finishedAt: Date.now() }
                : it,
            ),
          );
        } catch (err) {
          setItems((p) =>
            p.map((it) =>
              it.id === next.id
                ? {
                    ...it,
                    status: "error",
                    message: err instanceof Error ? err.message : "Error desconocido",
                    finishedAt: Date.now(),
                  }
                : it,
            ),
          );
        } finally {
          inFlightRef.current -= 1;
          tick();
        }
      });

      queueMicrotask(() => tick());
      return updated;
    });
  }, [concurrency, processOne]);

  const start = useCallback(() => {
    if (loopActiveRef.current) {
      isRunningRef.current = true;
      setIsRunning(true);
      return;
    }
    loopActiveRef.current = true;
    isRunningRef.current = true;
    setIsRunning(true);
    tick();
  }, [tick]);

  const pause = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
  }, []);

  return {
    items,
    enqueueFiles,
    start,
    pause,
    clearAll,
    retry,
    isRunning,
    stats: { queuedCount, processingCount, completedCount, errorCount },
  };
}
