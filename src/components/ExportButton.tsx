"use client";

import { formatDateBR } from "@/lib/calc";
import type { DaySummary } from "@/lib/types";

const COLUMNS: [string, (d: DaySummary) => string | number][] = [
  ["Data", (d) => formatDateBR(d.date)],
  ["Dinheiro", (d) => Number(d.total_dinheiro)],
  ["Pix", (d) => Number(d.total_pix)],
  ["Cartao", (d) => Number(d.total_cartao)],
  ["Total caderno", (d) => Number(d.total_caderno)],
  ["Total caixa", (d) => Number(d.total_caixa)],
  ["Diferenca", (d) => Number(d.difference)],
  ["Funcionarios", (d) => Number(d.total_funcionarios)],
  ["Total livre", (d) => Number(d.total_livre)],
];

export default function ExportButton({ month, days }: { month: string; days: DaySummary[] }) {
  function download() {
    const rows = [
      COLUMNS.map(([h]) => h),
      // Decimal com virgula: e assim que o Excel em pt-BR espera.
      ...days.map((d) =>
        COLUMNS.map(([, get]) => {
          const v = get(d);
          return typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
        })
      ),
    ];
    const csv = rows.map((r) => r.join(";")).join("\r\n");
    // BOM para o Excel reconhecer os acentos.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caixa-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={download} className="btn-ghost text-sm" disabled={days.length === 0}>
      Exportar CSV
    </button>
  );
}
