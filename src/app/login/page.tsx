"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message
      );
      setLoading(false);
      return;
    }
    router.replace(params.get("next") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Fechamento de Caixa</h1>
        <p className="mt-1 text-sm text-muted">Entre para continuar.</p>
      </div>

      <div className="space-y-1">
        <label className="label" htmlFor="email">E-mail</label>
        <input
          id="email" type="email" required autoComplete="email" className="input"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="label" htmlFor="password">Senha</label>
        <input
          id="password" type="password" required autoComplete="current-password" className="input"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-sm text-neg">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Suspense fallback={<div className="card w-full max-w-sm">Carregando…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
