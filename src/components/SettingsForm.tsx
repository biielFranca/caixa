"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/calc";
import type { Settings } from "@/lib/types";

export default function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState({
    default_daily_rate: String(settings.default_daily_rate),
    default_per_delivery: String(settings.default_per_delivery),
    default_free_deliveries: String(settings.default_free_deliveries),
    kitchen_amount: String(settings.kitchen_amount),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const daily = Number(form.default_daily_rate) || 0;
  const per = Number(form.default_per_delivery) || 0;
  const free = Number(form.default_free_deliveries) || 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("settings")
      .update({
        default_daily_rate: daily,
        default_per_delivery: per,
        default_free_deliveries: free,
        kitchen_amount: Number(form.kitchen_amount) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setMessage(error ? error.message : "Configuração salva.");
    setBusy(false);
    router.refresh();
  }

  const FIELDS: [keyof typeof form, string, string][] = [
    ["default_daily_rate", "Diária padrão", "Valor base que o entregador recebe no dia."],
    ["default_per_delivery", "Valor por entrega", "Pago por entrega acima da franquia."],
    ["default_free_deliveries", "Entregas inclusas na diária", "Até esse número o valor é a diária cheia."],
    ["kitchen_amount", "Valor da cozinha", "Valor fixo por dia trabalhado."],
  ];

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <h2 className="font-semibold">Padrões de pagamento</h2>
        <p className="mt-1 text-sm text-muted">
          Usados ao cadastrar um funcionário novo. Quem já está cadastrado mantém a
          própria regra — altere na tela de Funcionários.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([key, label, hint]) => (
          <div key={key} className="space-y-1">
            <label className="label">{label}</label>
            <input
              className="input tabular-nums" inputMode="decimal"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
            <p className="text-xs text-muted">{hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-bg p-3 text-sm">
        <span className="text-muted">Simulação: </span>
        {[5, free, free + 1, 20].map((n, i) => (
          <span key={n}>
            {i > 0 && <span className="text-muted"> · </span>}
            <span className="text-muted">{n} entregas = </span>
            <strong className="tabular-nums">
              {formatBRL(Math.max(0, n - free) * per + daily)}
            </strong>
          </span>
        ))}
      </div>

      {message && <p className="text-sm text-pos">{message}</p>}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
