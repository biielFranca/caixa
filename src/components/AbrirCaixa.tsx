"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateBR, parseMoney, weekdayBR } from "@/lib/calc";
import MoneyInput from "./MoneyInput";

/** Estado inicial do dia: o caixa so passa a existir depois de aberto. */
export default function AbrirCaixa({ date }: { date: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [cashOpen, setCashOpen] = useState("");
  const [coinOpen, setCoinOpen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("days").insert({
      date,
      cash_open: parseMoney(cashOpen),
      coin_open: parseMoney(coinOpen),
      closed_at: null,
    });
    if (error) {
      setError(
        error.code === "23505"
          ? "Este dia já foi aberto. Atualize a página."
          : error.message
      );
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={abrir} className="card space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{formatDateBR(date)}</h1>
          <p className="mt-1 text-sm text-muted">
            {weekdayBR(date)} · caixa fechado
          </p>
        </div>

        <p className="text-sm text-muted">
          Informe o fundo de troco para começar o dia.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="label" htmlFor="cash">Dinheiro inicial</label>
            <MoneyInput id="cash" value={cashOpen} onChange={setCashOpen} ariaLabel="Dinheiro inicial" />
          </div>
          <div className="space-y-1">
            <label className="label" htmlFor="coin">Moeda inicial</label>
            <MoneyInput id="coin" value={coinOpen} onChange={setCoinOpen} ariaLabel="Moeda inicial" />
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-sm text-neg">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Abrindo…" : "Abrir caixa"}
        </button>
      </form>
    </div>
  );
}
