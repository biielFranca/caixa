"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatBRL } from "@/lib/calc";

export default function RevenueChart({
  data,
}: {
  data: { date: string; caderno: number }[];
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sem dados no período.</p>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
          <XAxis
            dataKey="date" tickLine={false} axisLine={false}
            tick={{ fill: "rgb(var(--muted))", fontSize: 11 }}
            // dd/MM: a janela cruza meses, so o dia confundiria.
            tickFormatter={(v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tickLine={false} axisLine={false} width={64}
            tick={{ fill: "rgb(var(--muted))", fontSize: 11 }}
            tickFormatter={(v: number) => `${Math.round(v / 100) / 10}k`}
          />
          <Tooltip
            cursor={{ fill: "rgb(var(--line) / 0.4)" }}
            contentStyle={{
              background: "rgb(var(--surface))",
              border: "1px solid rgb(var(--line))",
              borderRadius: 10,
              color: "rgb(var(--ink))",
              fontSize: 13,
            }}
            labelFormatter={(v: string) => v.split("-").reverse().join("/")}
            formatter={(v: number) => [formatBRL(v), "Faturamento"]}
          />
          <Bar dataKey="caderno" fill="rgb(var(--brand))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
