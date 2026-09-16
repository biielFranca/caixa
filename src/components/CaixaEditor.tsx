"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dayTotals, formatBRL, formatDateBR, shiftAmount, weekdayBR } from "@/lib/calc";
import { METHOD_LABEL, PLATFORMS, PLATFORM_LABEL } from "@/lib/types";
import type { Day, Employee, Entry, Method, Platform, PlatformRevenue, Shift } from "@/lib/types";
import EntryColumn, { type DraftEntry } from "./EntryColumn";
import { Stat } from "./Stat";

type Props = {
  date: string;
  day: Day | null;
  entries: Entry[];
  shifts: Shift[];
  employees: Employee[];
  platforms: PlatformRevenue[];
};

type ShiftDraft = { deliveries: string; amount: string; note: string; enabled: boolean };

function moneyToNumber(v: string): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function CaixaEditor({ date, day, entries, shifts, employees, platforms }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [cashOpen, setCashOpen] = useState(String(day?.cash_open ?? 0));
  const [coinOpen, setCoinOpen] = useState(String(day?.coin_open ?? 0));
  const [countedCash, setCountedCash] = useState(String(day?.counted_cash ?? 0));
  const [countedCoin, setCountedCoin] = useState(String(day?.counted_coin ?? 0));
  const [notes, setNotes] = useState(day?.notes ?? "");

  const [draft, setDraft] = useState<Record<Method, DraftEntry[]>>(() => {
    const init: Record<Method, DraftEntry[]> = { dinheiro: [], pix: [], cartao: [] };
    entries.forEach((e) =>
      init[e.method].push({ key: e.id, amount: Number(e.amount), note: e.note })
    );
    return init;
  });

  const [shiftDraft, setShiftDraft] = useState<Record<string, ShiftDraft>>(() => {
    const init: Record<string, ShiftDraft> = {};
    employees.forEach((emp) => {
      const s = shifts.find((x) => x.employee_id === emp.id);
      // So preenche "sobrescrever" quando o valor salvo difere da regra do
      // funcionario. Caso contrario o campo fica livre e o calculo automatico manda.
      const computed = shiftAmount(emp, s?.deliveries ?? null);
      const isOverride =
        s?.amount != null && Math.abs(Number(s.amount) - computed) > 0.005;
      init[emp.id] = {
        deliveries: s?.deliveries != null ? String(s.deliveries) : "",
        amount: isOverride ? String(s!.amount) : "",
        note: s?.note ?? "",
        enabled: !!s,
      };
    });
    return init;
  });

  const [platformDraft, setPlatformDraft] = useState<Record<Platform, string>>(() => {
    const init = {} as Record<Platform, string>;
    PLATFORMS.forEach((p) => {
      const found = platforms.find((x) => x.platform === p);
      init[p] = found ? String(found.amount) : "";
    });
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // ---------- totais ao vivo ----------
  const totals = useMemo(() => {
    const flat = (["dinheiro", "pix", "cartao"] as Method[]).flatMap((m) =>
      draft[m].map((e) => ({ method: m, amount: e.amount } as Entry))
    );
    return dayTotals(flat, {
      cashOpen: moneyToNumber(cashOpen),
      coinOpen: moneyToNumber(coinOpen),
      countedCash: moneyToNumber(countedCash),
      countedCoin: moneyToNumber(countedCoin),
    });
  }, [draft, cashOpen, coinOpen, countedCash, countedCoin]);

  const payroll = useMemo(() => {
    let total = 0;
    for (const emp of employees) {
      const d = shiftDraft[emp.id];
      if (!d?.enabled) continue;
      total += d.amount.trim()
        ? moneyToNumber(d.amount)
        : shiftAmount(emp, d.deliveries.trim() === "" ? null : Number(d.deliveries));
    }
    return Math.round(total * 100) / 100;
  }, [shiftDraft, employees]);

  const livre = useMemo(
    () => PLATFORMS.reduce((acc, p) => acc + moneyToNumber(platformDraft[p]), 0),
    [platformDraft]
  );

  // ---------- salvar ----------
  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const { data: savedDay, error: dayErr } = await supabase
        .from("days")
        .upsert(
          {
            date,
            cash_open: moneyToNumber(cashOpen),
            coin_open: moneyToNumber(coinOpen),
            counted_cash: moneyToNumber(countedCash),
            counted_coin: moneyToNumber(countedCoin),
            notes: notes.trim() || null,
            needs_review: false,
            closed_at: new Date().toISOString(),
          },
          { onConflict: "date" }
        )
        .select()
        .single();
      if (dayErr) throw dayErr;
      const dayId = savedDay.id as string;

      // Lancamentos: substitui o conjunto do dia (mais simples e previsivel que diff).
      const { error: delErr } = await supabase.from("entries").delete().eq("day_id", dayId);
      if (delErr) throw delErr;

      const rows = (["dinheiro", "pix", "cartao"] as Method[]).flatMap((m) =>
        draft[m].map((e, i) => ({
          day_id: dayId, method: m, amount: e.amount, note: e.note, position: i,
        }))
      );
      if (rows.length) {
        const { error } = await supabase.from("entries").insert(rows);
        if (error) throw error;
      }

      // Turnos
      const { error: sDelErr } = await supabase.from("day_shifts").delete().eq("day_id", dayId);
      if (sDelErr) throw sDelErr;

      const shiftRows = employees
        .filter((emp) => shiftDraft[emp.id]?.enabled)
        .map((emp) => {
          const d = shiftDraft[emp.id];
          const deliveries = d.deliveries.trim() === "" ? null : Number(d.deliveries);
          return {
            day_id: dayId,
            employee_id: emp.id,
            deliveries,
            amount: d.amount.trim() ? moneyToNumber(d.amount) : shiftAmount(emp, deliveries),
            note: d.note.trim() || null,
          };
        });
      if (shiftRows.length) {
        const { error } = await supabase.from("day_shifts").insert(shiftRows);
        if (error) throw error;
      }

      // Plataformas
      const platRows = PLATFORMS.filter((p) => platformDraft[p].trim() !== "").map((p) => ({
        day_id: dayId, platform: p, amount: moneyToNumber(platformDraft[p]),
      }));
      const { error: pDelErr } = await supabase.from("platform_revenue").delete().eq("day_id", dayId);
      if (pDelErr) throw pDelErr;
      if (platRows.length) {
        const { error } = await supabase.from("platform_revenue").insert(platRows);
        if (error) throw error;
      }

      setMessage({ kind: "ok", text: "Fechamento salvo." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  const diffTone = Math.abs(totals.diferenca) < 0.01 ? "neutral" : totals.diferenca > 0 ? "pos" : "neg";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{formatDateBR(date)}</h1>
          <p className="text-sm text-muted">
            {weekdayBR(date)}
            {day?.needs_review && " · importado da planilha, confira os valores"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm ${message.kind === "ok" ? "text-pos" : "text-neg"}`}>
              {message.text}
            </span>
          )}
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Salvando…" : "Salvar fechamento"}
          </button>
        </div>
      </div>

      {/* Abertura e contagem */}
      <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Dinheiro inicial", value: cashOpen, set: setCashOpen },
          { label: "Moeda inicial", value: coinOpen, set: setCoinOpen },
          { label: "Dinheiro contado", value: countedCash, set: setCountedCash },
          { label: "Moeda contada", value: countedCoin, set: setCountedCoin },
        ].map((f) => (
          <div key={f.label} className="space-y-1">
            <label className="label">{f.label}</label>
            <input
              className="input tabular-nums" inputMode="decimal"
              value={f.value} onChange={(e) => f.set(e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Lancamentos */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["dinheiro", "pix", "cartao"] as Method[]).map((m) => (
          <EntryColumn
            key={m}
            method={m}
            title={METHOD_LABEL[m]}
            entries={draft[m]}
            onChange={(next) => setDraft((d) => ({ ...d, [m]: next }))}
          />
        ))}
      </div>

      {/* Conferencia */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total caderno" value={totals.caderno} hint="Tudo que foi lançado" />
        <Stat label="Total caixa" value={totals.caixa} hint="Conferido, sem o fundo de troco" />
        <Stat
          label={totals.diferenca >= 0 ? "Sobra" : "Falta"}
          value={totals.diferenca}
          tone={diffTone as "neutral" | "pos" | "neg"}
          hint="Caixa − caderno"
        />
        <Stat label="Total livre" value={livre} hint="Soma dos canais" />
      </div>

      {/* Funcionarios */}
      <div className="card">
        <h3 className="font-semibold">Funcionários</h3>
        <p className="mt-1 text-xs text-muted">
          Marque quem trabalhou. O valor é calculado pela regra de cada um — preencha
          &quot;valor&quot; só para sobrescrever.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-2">Trabalhou</th>
                <th className="py-2 pr-2">Nome</th>
                <th className="py-2 pr-2">Entregas</th>
                <th className="py-2 pr-2">Calculado</th>
                <th className="py-2 pr-2">Valor (sobrescrever)</th>
                <th className="py-2">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const d = shiftDraft[emp.id];
                const computed = shiftAmount(
                  emp,
                  d.deliveries.trim() === "" ? null : Number(d.deliveries)
                );
                const update = (patch: Partial<ShiftDraft>) =>
                  setShiftDraft((s) => ({ ...s, [emp.id]: { ...s[emp.id], ...patch } }));
                return (
                  <tr key={emp.id} className="border-b border-line/60">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox" checked={d.enabled}
                        onChange={(e) => update({ enabled: e.target.checked })}
                        aria-label={`${emp.name} trabalhou`}
                        className="size-4 accent-[rgb(var(--brand))]"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      {emp.name}
                      {emp.role === "cozinha" && (
                        <span className="ml-1 text-xs text-muted">(fixo)</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {emp.role === "cozinha" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <input
                          className="input w-20 tabular-nums" inputMode="numeric"
                          value={d.deliveries} disabled={!d.enabled}
                          onChange={(e) => update({ deliveries: e.target.value })}
                          aria-label={`Entregas de ${emp.name}`}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-muted">
                      {d.enabled ? formatBRL(computed) : "—"}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="input w-28 tabular-nums" inputMode="decimal"
                        placeholder="auto" value={d.amount} disabled={!d.enabled}
                        onChange={(e) => update({ amount: e.target.value })}
                        aria-label={`Valor de ${emp.name}`}
                      />
                    </td>
                    <td className="py-2">
                      <input
                        className="input min-w-32" value={d.note} disabled={!d.enabled}
                        onChange={(e) => update({ note: e.target.value })}
                        aria-label={`Observação de ${emp.name}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="label">Total a pagar</span>
          <span className="text-lg font-semibold tabular-nums">{formatBRL(payroll)}</span>
        </div>
      </div>

      {/* Plataformas + observacoes */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold">Total livre</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {PLATFORMS.map((p) => (
              <div key={p} className="space-y-1">
                <label className="label">{PLATFORM_LABEL[p]}</label>
                <input
                  className="input tabular-nums" inputMode="decimal" placeholder="0,00"
                  value={platformDraft[p]}
                  onChange={(e) => setPlatformDraft((s) => ({ ...s, [p]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold">Observações do dia</h3>
          <textarea
            className="input mt-3 min-h-28 resize-y" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações, ocorrências, quebras de caixa…"
          />
        </div>
      </div>
    </div>
  );
}
