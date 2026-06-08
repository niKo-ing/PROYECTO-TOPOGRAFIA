"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && status !== "loading";
  }, [email, password, status]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const baseError = data?.error ?? "No se pudo iniciar sesión";
        const detailsMsg = data?.details?.message ? ` (${data.details.message})` : "";
        setError(`${baseError}${detailsMsg}`);
        setStatus("idle");
        return;
      }

      router.replace("/dashboard");
    } catch {
      setError("Error de red. Intenta nuevamente.");
      setStatus("idle");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur-sm z-10">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-2">
            GeoExtract Pro
          </h1>
          <p className="text-center text-sm text-slate-400">
            Inicia sesión para procesar PDFs y exportar coordenadas.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="tu@empresa.com"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-200">Contraseña</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 mt-4"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar
            </span>
          </button>

          <p className="text-xs text-slate-500">
            La sesión se guarda como Cookie HTTP-only (no accesible desde JavaScript).
          </p>
        </form>
      </div>
    </div>
  );
}
