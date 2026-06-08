"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/TextInput";

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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Acceso</h1>
          <p className="text-sm text-zinc-600">
            Inicia sesión para procesar PDFs y exportar coordenadas.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800">Email</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <TextInput
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                className="pl-9"
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800">Contraseña</span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <TextInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-9"
              />
            </div>
          </label>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar
          </Button>

          <p className="text-xs text-zinc-500">
            La sesión se guarda como Cookie HTTP-only (no accesible desde JavaScript).
          </p>
        </form>
      </div>
    </div>
  );
}
