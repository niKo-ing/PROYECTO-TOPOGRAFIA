"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useDocuments({ limit = 20 } = {}) {
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError("");

    try {
      const res = await fetch(`/api/documents?limit=${encodeURIComponent(limit)}`, {
        method: "GET",
        signal: controller.signal,
      });

      const payload = await res.json().catch(() => null);
      if (process.env.NODE_ENV !== "production") {
        console.log("Datos recibidos del servidor:", payload);
      }
      if (!res.ok) {
        const msg = payload?.error ?? `Error cargando documentos (HTTP ${res.status})`;
        setStatus("error");
        setError(msg);
        return;
      }

      const nextDocs = Array.isArray(payload?.documents)
        ? payload.documents
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];
      setDocuments(nextDocs);
      setStatus("idle");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setStatus("error");
      setError("Error de red cargando documentos");
    }
  }, [limit]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      refresh();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      abortRef.current?.abort?.();
    };
  }, [refresh]);

  const remove = useCallback(async (documentId) => {
    const id = String(documentId ?? "").trim();
    if (!id) return;

    const previous = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== id));

    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setDocuments(previous);
        throw new Error(payload?.error ?? "No se pudo eliminar el documento");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando documento");
    }
  }, [documents]);

  const stats = useMemo(() => {
    const completed = documents.filter((d) => d.status === "completed");
    const totalPdfs = completed.length;
    const totalCoords = completed.reduce((acc, d) => acc + (Number(d.rows_count) || 0), 0);
    return { totalPdfs, totalCoords };
  }, [documents]);

  return { documents, status, error, refresh, remove, stats };
}
