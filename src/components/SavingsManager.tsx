"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatDateBR, todayISO } from "@/lib/calc";
import type { Saving } from "@/lib/types";

export default function SavingsManager({
  savings, people,
}: {
  savings: Saving[];
  people: string[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [person, setPerson] = useState(people[0] ?? "");
  const [newPerson, setNewPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byPerson = useMemo(() => {
    const map = new Map<string, Saving[]>();
    for (const s of savings) {
      if (!map.has(s.person)) map.set(s.person, []);
      map.get(s.person)!.push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [savings]);

  const grandTotal = savings.reduce((a, s) => a + Number(s.amount), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const target = (newPerson.trim() || person).trim();
    const value = Number(amount.replace(",", "."));
    if (!target || !Number.isFinite(value) || value === 0) {
      setError("Informe a pessoa e um valor diferente de zero.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("savings").insert({
      person: target, amount: value, date: date || null, note: note.trim() || null,
    });
    if (error) { setError(error.message); setBusy(false); return; }
    setAmount(""); setNote(""); setNewPerson("");
    setPerson(target);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await supabase.from("savings").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3">
        <h2 className="font-semibold">Novo registro</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="label">Pessoa</label>
            <select
              className="input" value={person}
              onChange={(e) => { setPerson(e.target.value); setNewPerson(""); }}
              disabled={!!newPerson.trim()}
            >
              {people.length === 0 && <option value="">—</option>}
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Ou nova pessoa</label>
            <input
              className="input" value={newPerson} placeholder="Nome"
              onChange={(e) => setNewPerson(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="label">Valor</label>
            <input
              className="input tabular-nums" inputMode="decimal" placeholder="0,00"
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />
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
          Use valor negativo para registrar uma retirada.
        </p>
        {error && <p className="text-sm text-neg">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>Adicionar</button>
      </form>

      <div className="card flex items-baseline justify-between">
        <span className="label">Total guardado</span>
        <span className="text-xl font-semibold tabular-nums">{formatBRL(grandTotal)}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {byPerson.map(([name, items]) => {
          const total = items.reduce((a, s) => a + Number(s.amount), 0);
          return (
            <div key={name} className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{name}</h3>
                <span className={`font-semibold tabular-nums ${total < 0 ? "text-neg" : ""}`}>
                  {formatBRL(total)}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-line text-sm">
                {items
                  .slice()
                  .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-2 py-1.5">
                      <span className="w-20 shrink-0 text-xs text-muted">
                        {s.date ? formatDateBR(s.date) : "sem data"}
                      </span>
                      <span className="flex-1 truncate text-xs text-muted">{s.note ?? ""}</span>
                      <span className="tabular-nums">{formatBRL(Number(s.amount))}</span>
                      <button
                        onClick={() => remove(s.id)} disabled={busy}
                        className="shrink-0 px-1 text-muted hover:text-neg"
                        aria-label="Remover registro"
                      >
                        ×
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
        {byPerson.length === 0 && (
          <div className="card text-sm text-muted">Nenhum registro ainda.</div>
        )}
      </div>
    </div>
  );
}
