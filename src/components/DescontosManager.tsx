"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatDateBR, parseMoney, round, todayISO } from "@/lib/calc";
import MoneyInput from "./MoneyInput";
import type { Desconto, Employee } from "@/lib/types";

export default function DescontosManager({
  descontos, employees,
}: {
  descontos: Desconto[];
  employees: Employee[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e.name]));
    return (d: Desconto) =>
      (d.employee_id && map.get(d.employee_id)) || d.person || "Sem nome";
  }, [employees]);

  const grouped = useMemo(() => {
    const map = new Map<string, Desconto[]>();
    for (const d of descontos) {
      const key = nameOf(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [descontos, nameOf]);

  const total = round(descontos.reduce((a, d) => a + Number(d.amount), 0));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = parseMoney(amount);
    if (!employeeId || value === 0) {
      setError("Escolha a pessoa e informe um valor diferente de zero.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("descontos").insert({
      employee_id: employeeId,
      person: employees.find((x) => x.id === employeeId)?.name ?? null,
      date: date || null,
      amount: value,
      note: note.trim() || null,
    });
    if (error) { setError(error.message); setBusy(false); return; }
    setAmount(""); setNote("");
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await supabase.from("descontos").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }

  const motoboys = employees.filter((e) => e.role === "entregador");
  const outros = employees.filter((e) => e.role !== "entregador");

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3">
        <h2 className="font-semibold">Novo desconto</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="label">Pessoa</label>
            <select
              className="input" value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              {motoboys.length > 0 && (
                <optgroup label="Motoboys">
                  {motoboys.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              )}
              {outros.length > 0 && (
                <optgroup label="Cozinha">
                  {outros.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Valor</label>
            <MoneyInput value={amount} onChange={setAmount} ariaLabel="Valor do desconto" />
          </div>
          <div className="space-y-1">
            <label className="label">Data</label>
            <input
              type="date" className="input" value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="label">Observação</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted">
          Desconto de motoboy abate do pagamento do mês. O da cozinha fica só registrado,
          porque o valor da cozinha é do time inteiro.
        </p>
        {error && <p className="text-sm text-neg">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>Adicionar</button>
      </form>

      <div className="card flex items-baseline justify-between">
        <span className="label">Total descontado</span>
        <span className="text-xl font-semibold tabular-nums">{formatBRL(total)}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {grouped.map(([name, items]) => {
          const soma = round(items.reduce((a, d) => a + Number(d.amount), 0));
          return (
            <div key={name} className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{name}</h3>
                <span className="font-semibold tabular-nums">{formatBRL(soma)}</span>
              </div>
              <ul className="mt-2 divide-y divide-line text-sm">
                {items
                  .slice()
                  .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                  .map((d) => (
                    <li key={d.id} className="flex items-center gap-2 py-1.5">
                      <span className="w-20 shrink-0 text-xs text-muted">
                        {d.date ? formatDateBR(d.date) : "sem data"}
                      </span>
                      <span className="flex-1 truncate text-xs text-muted">{d.note ?? ""}</span>
                      <span className="tabular-nums">{formatBRL(Number(d.amount))}</span>
                      <button
                        onClick={() => remove(d.id)} disabled={busy}
                        className="shrink-0 px-1 text-muted hover:text-neg"
                        aria-label="Remover desconto"
                      >
                        ×
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div className="card text-sm text-muted">Nenhum desconto lançado.</div>
        )}
      </div>
    </div>
  );
}
