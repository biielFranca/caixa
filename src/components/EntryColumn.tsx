"use client";

import { useState } from "react";
import { formatBRL, parseMoney, sum } from "@/lib/calc";
import MoneyInput from "./MoneyInput";
import type { Method } from "@/lib/types";

export type DraftEntry = { key: string; amount: number; note: string | null };

export default function EntryColumn({
  title, method, entries, onChange, readOnly = false,
}: {
  title: string;
  method: Method;
  entries: DraftEntry[];
  onChange: (next: DraftEntry[]) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = parseMoney(draft);
    if (!draft.trim() || value === 0) return;
    onChange([
      ...entries,
      { key: `${method}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, amount: value, note: null },
    ]);
    setDraft("");
  }

  const total = sum(entries.map((e) => e.amount));

  return (
    <div className="card flex flex-col">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted">{entries.length} lanç.</span>
      </div>

      {!readOnly && (
      <div className="mt-3 flex gap-2">
        <div className="flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}>
          <MoneyInput
            value={draft} onChange={setDraft}
            ariaLabel={`Novo lançamento em ${title}`}
          />
        </div>
        <button type="button" onClick={add} className="btn-ghost shrink-0" aria-label="Adicionar">
          +
        </button>
      </div>
      )}

      <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {entries.map((e, i) => (
          <li key={e.key} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-bg">
            <span className="w-6 shrink-0 text-xs text-muted tabular-nums">{i + 1}</span>
            <span className="flex-1 tabular-nums">{formatBRL(e.amount)}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onChange(entries.filter((x) => x.key !== e.key))}
                className="shrink-0 px-1 text-sm text-muted hover:text-neg"
                aria-label={`Remover lançamento ${i + 1}`}
              >
                ×
              </button>
            )}
          </li>
        ))}
        {entries.length === 0 && (
          <li className="px-2 py-3 text-sm text-muted">Nenhum lançamento.</li>
        )}
      </ul>

      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="label">Soma</span>
        <span className="text-lg font-semibold tabular-nums">{formatBRL(total)}</span>
      </div>
    </div>
  );
}
