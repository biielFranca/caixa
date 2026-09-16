"use client";

import { useRouter } from "next/navigation";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function MonthSelect({
  month, months, basePath = "/historico",
}: {
  month: string;
  months: string[];
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={month}
      onChange={(e) => router.push(`${basePath}?mes=${e.target.value}`)}
      className="input py-1.5 text-sm capitalize"
      aria-label="Selecionar mês"
    >
      {months.map((m) => (
        <option key={m} value={m}>{monthLabel(m)}</option>
      ))}
    </select>
  );
}
