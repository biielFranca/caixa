"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, parseMoney, shiftAmount, slugify } from "@/lib/calc";
import MoneyInput from "./MoneyInput";
import type { Employee, Role, Settings } from "@/lib/types";

type Totals = Record<
  string,
  { dias: number; entregas: number; bruto: number; desconto: number; valor: number }
>;

const EMPTY = {
  name: "", role: "entregador" as Role,
  daily_rate: "", per_delivery: "", free_deliveries: "", fixed_amount: "",
};

export default function EmployeeManager({
  employees, totals, settings, monthLabel,
}: {
  employees: Employee[];
  totals: Totals;
  settings: Settings;
  monthLabel: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(emp: Employee) {
    setEditing(emp.id);
    setForm({
      name: emp.name,
      role: emp.role,
      daily_rate: String(emp.daily_rate),
      per_delivery: String(emp.per_delivery),
      free_deliveries: String(emp.free_deliveries),
      fixed_amount: emp.fixed_amount != null ? String(emp.fixed_amount) : "",
    });
  }

  function reset() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);

    const isKitchen = form.role === "cozinha";
    const payload = {
      name: form.name.trim(),
      slug: slugify(form.name),
      role: form.role,
      daily_rate: form.daily_rate.trim() ? parseMoney(form.daily_rate) : settings.default_daily_rate,
      per_delivery: form.per_delivery.trim() ? parseMoney(form.per_delivery) : settings.default_per_delivery,
      free_deliveries: Number(form.free_deliveries || settings.default_free_deliveries),
      fixed_amount: isKitchen
        ? (form.fixed_amount.trim() ? parseMoney(form.fixed_amount) : settings.kitchen_amount)
        : form.fixed_amount.trim() ? parseMoney(form.fixed_amount) : null,
    };

    const { error } = editing
      ? await supabase.from("employees").update(payload).eq("id", editing)
      : await supabase.from("employees").insert(payload);

    if (error) {
      setError(
        error.code === "23505"
          ? "Já existe um funcionário com esse nome."
          : error.message
      );
      setBusy(false);
      return;
    }
    reset();
    setBusy(false);
    router.refresh();
  }

  async function toggleActive(emp: Employee) {
    setBusy(true);
    await supabase.from("employees").update({ active: !emp.active }).eq("id", emp.id);
    setBusy(false);
    router.refresh();
  }

  const active = employees.filter((e) => e.active);
  const inactive = employees.filter((e) => !e.active);

  function Row({ emp }: { emp: Employee }) {
    const t = totals[emp.id];
    return (
      <tr className="border-b border-line/60">
        <td className="py-2 pr-3">
          <span className={emp.active ? "" : "text-muted line-through"}>{emp.name}</span>
        </td>
        <td className="py-2 pr-3 text-muted">
          {emp.role === "cozinha" ? "Cozinha" : emp.role === "entregador" ? "Entregador" : "Outro"}
        </td>
        <td className="py-2 pr-3 text-xs text-muted">
          {emp.role === "cozinha" || emp.fixed_amount != null
            ? `Fixo ${formatBRL(emp.fixed_amount ?? 0)}`
            : `${formatBRL(emp.daily_rate)} até ${emp.free_deliveries} entregas, +${formatBRL(emp.per_delivery)} por entrega acima`}
        </td>
        <td className="py-2 pr-3 text-right tabular-nums">{t?.dias ?? 0}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{t?.entregas ?? 0}</td>
        <td className="py-2 pr-3 text-right tabular-nums text-muted">
          {t?.desconto ? formatBRL(t.desconto) : "—"}
        </td>
        <td className="py-2 pr-3 text-right font-medium tabular-nums">{formatBRL(t?.valor ?? 0)}</td>
        <td className="py-2 text-right">
          <button onClick={() => startEdit(emp)} className="px-2 text-sm text-muted hover:text-brand">
            Editar
          </button>
          <button
            onClick={() => toggleActive(emp)} disabled={busy}
            className="px-2 text-sm text-muted hover:text-neg"
          >
            {emp.active ? "Desativar" : "Reativar"}
          </button>
        </td>
      </tr>
    );
  }

  const preview =
    form.role === "cozinha"
      ? (form.fixed_amount.trim() ? parseMoney(form.fixed_amount) : settings.kitchen_amount)
      : shiftAmount(
          {
            role: form.role,
            fixed_amount: form.fixed_amount.trim() ? parseMoney(form.fixed_amount) : null,
            daily_rate: form.daily_rate.trim() ? parseMoney(form.daily_rate) : settings.default_daily_rate,
            per_delivery: form.per_delivery.trim() ? parseMoney(form.per_delivery) : settings.default_per_delivery,
            free_deliveries: Number(form.free_deliveries || settings.default_free_deliveries),
          } as Employee,
          20
        );

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card space-y-3">
        <h2 className="font-semibold">{editing ? "Editar funcionário" : "Novo funcionário"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1 lg:col-span-2">
            <label className="label">Nome</label>
            <input
              className="input" value={form.name} required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="label">Função</label>
            <select
              className="input" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="entregador">Entregador</option>
              <option value="cozinha">Cozinha</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {form.role === "cozinha" ? (
            <div className="space-y-1">
              <label className="label">Valor fixo</label>
              <MoneyInput
                value={form.fixed_amount} ariaLabel="Valor fixo"
                placeholder={String(settings.kitchen_amount)}
                onChange={(v) => setForm({ ...form, fixed_amount: v })}
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="label">Diária</label>
                <MoneyInput
                  value={form.daily_rate} ariaLabel="Diária"
                  placeholder={String(settings.default_daily_rate)}
                  onChange={(v) => setForm({ ...form, daily_rate: v })}
                />
              </div>
              <div className="space-y-1">
                <label className="label">Por entrega</label>
                <MoneyInput
                  value={form.per_delivery} ariaLabel="Por entrega"
                  placeholder={String(settings.default_per_delivery)}
                  onChange={(v) => setForm({ ...form, per_delivery: v })}
                />
              </div>
              <div className="space-y-1">
                <label className="label">Entregas na diária</label>
                <input
                  className="input tabular-nums" inputMode="numeric"
                  placeholder={String(settings.default_free_deliveries)} value={form.free_deliveries}
                  onChange={(e) => setForm({ ...form, free_deliveries: e.target.value })}
                />
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-muted">
          {form.role === "cozinha"
            ? `Recebe ${formatBRL(preview)} por dia trabalhado.`
            : `A diária é o piso: até ${form.free_deliveries || settings.default_free_deliveries} ` +
              `entregas recebe ${formatBRL(form.daily_rate.trim() ? parseMoney(form.daily_rate) : settings.default_daily_rate)}. ` +
              `Com 20 entregas, ${formatBRL(preview)}.`}
        </p>

        {error && <p className="text-sm text-neg">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>
            {editing ? "Salvar alterações" : "Adicionar"}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="btn-ghost">Cancelar</button>
          )}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold">Ativos · totais de {monthLabel}</h2>
        <table className="mt-3 w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3">Nome</th>
              <th className="py-2 pr-3">Função</th>
              <th className="py-2 pr-3">Regra</th>
              <th className="py-2 pr-3 text-right">Dias</th>
              <th className="py-2 pr-3 text-right">Entregas</th>
              <th className="py-2 pr-3 text-right">Desconto</th>
              <th className="py-2 pr-3 text-right">Pago</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {active.map((emp) => <Row key={emp.id} emp={emp} />)}
            {active.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-muted">Nenhum funcionário ativo.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {inactive.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">
            Inativos ({inactive.length})
          </summary>
          <table className="mt-3 w-full min-w-[44rem] text-sm">
            <tbody>{inactive.map((emp) => <Row key={emp.id} emp={emp} />)}</tbody>
          </table>
        </details>
      )}
    </div>
  );
}
