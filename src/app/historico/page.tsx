import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { Stat } from "@/components/Stat";
import ExportButton from "@/components/ExportButton";
import MonthSelect from "@/components/MonthSelect";
import { formatBRL, formatDateBR, todayISO, weekdayBR } from "@/lib/calc";
import type { DaySummary } from "@/lib/types";

export const dynamic = "force-dynamic";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { mes } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : todayISO().slice(0, 7);

  const supabase = await createClient();

  const [daysRes, allRes] = await Promise.all([
    supabase
      .from("day_summary").select("*")
      .gte("date", `${month}-01`).lte("date", lastDayOfMonth(month))
      .order("date", { ascending: false }),
    supabase.from("day_summary").select("date").order("date", { ascending: false }),
  ]);

  const days = (daysRes.data as DaySummary[]) ?? [];
  const months = Array.from(
    new Set(((allRes.data as { date: string }[]) ?? []).map((d) => d.date.slice(0, 7)))
  );

  const revenue = days.reduce((a, d) => a + Number(d.total_caderno), 0);
  const diff = days.reduce((a, d) => a + Number(d.difference), 0);
  const payroll = days.reduce((a, d) => a + Number(d.total_funcionarios), 0);
  const livre = days.reduce((a, d) => a + Number(d.total_livre), 0);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold capitalize">{monthLabel(month)}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <MonthSelect month={month} months={months} />
            <ExportButton month={month} days={days} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Faturamento" value={revenue} hint={`${days.length} dias`} />
          <Stat label="Sobra/falta" value={diff} tone="auto" />
          <Stat label="Funcionários" value={payroll} />
          <Stat label="Total livre" value={livre} />
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3 text-right">Dinheiro</th>
                <th className="py-2 pr-3 text-right">Pix</th>
                <th className="py-2 pr-3 text-right">Cartão</th>
                <th className="py-2 pr-3 text-right">Caderno</th>
                <th className="py-2 pr-3 text-right">Caixa</th>
                <th className="py-2 pr-3 text-right">Dif.</th>
                <th className="py-2 text-right">Funcion.</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.id} className="border-b border-line/60 hover:bg-bg">
                  <td className="py-2 pr-3">
                    <Link href={`/caixa/${d.date}`} className="hover:text-brand">
                      {formatDateBR(d.date)}
                      <span className="ml-2 text-xs text-muted">{weekdayBR(d.date).slice(0, 3)}</span>
                      {d.needs_review && (
                        <span className="ml-2 rounded bg-neg/10 px-1.5 py-0.5 text-[10px] text-neg">
                          revisar
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(Number(d.total_dinheiro))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(Number(d.total_pix))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(Number(d.total_cartao))}</td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums">{formatBRL(Number(d.total_caderno))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(Number(d.total_caixa))}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${
                    Math.abs(Number(d.difference)) < 0.01 ? "text-muted"
                      : Number(d.difference) > 0 ? "text-pos" : "text-neg"
                  }`}>
                    {formatBRL(Number(d.difference))}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatBRL(Number(d.total_funcionarios))}</td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted">Nenhum dia lançado neste mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
