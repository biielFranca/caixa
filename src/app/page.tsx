import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { Stat } from "@/components/Stat";
import RevenueChart from "@/components/RevenueChart";
import { formatBRL, formatDateBR, todayISO, weekdayBR } from "@/lib/calc";
import type { DaySummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [todayRes, monthRes, recentRes] = await Promise.all([
    supabase.from("day_summary").select("*").eq("date", today).maybeSingle(),
    supabase.from("day_summary").select("*").gte("date", monthStart).lte("date", today),
    supabase.from("day_summary").select("*").order("date", { ascending: false }).limit(30),
  ]);

  const todaySummary = todayRes.data as DaySummary | null;
  const month = (monthRes.data as DaySummary[]) ?? [];
  const recent = ((recentRes.data as DaySummary[]) ?? []).slice().reverse();

  const monthRevenue = month.reduce((a, d) => a + Number(d.total_caderno), 0);
  const monthDiff = month.reduce((a, d) => a + Number(d.difference), 0);
  const monthPayroll = month.reduce((a, d) => a + Number(d.total_funcionarios), 0);
  const monthLivre = month.reduce((a, d) => a + Number(d.total_livre), 0);
  const avgTicket = month.length ? monthRevenue / month.length : 0;

  const chart = recent.map((d) => ({ date: d.date, caderno: Number(d.total_caderno) }));
  const worst = month
    .slice()
    .sort((a, b) => Math.abs(Number(b.difference)) - Math.abs(Number(a.difference)))
    .slice(0, 5);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Painel</h1>
            <p className="text-sm text-muted">
              {weekdayBR(today)}, {formatDateBR(today)}
            </p>
          </div>
          <Link href={`/caixa/${today}`} className="btn-primary">
            {todaySummary ? "Abrir caixa de hoje" : "Fechar o caixa de hoje"}
          </Link>
        </div>

        {/* Hoje */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Hoje</h2>
          {todaySummary ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Faturamento" value={Number(todaySummary.total_caderno)} />
              <Stat label="Total no caixa" value={Number(todaySummary.total_caixa)} />
              <Stat
                label={Number(todaySummary.difference) >= 0 ? "Sobra" : "Falta"}
                value={Number(todaySummary.difference)}
                tone="auto"
              />
              <Stat label="Funcionários" value={Number(todaySummary.total_funcionarios)} />
            </div>
          ) : (
            <div className="card text-sm text-muted">
              O caixa de hoje ainda não foi lançado.
            </div>
          )}
        </section>

        {/* Mes */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">
            Mês atual · {month.length} {month.length === 1 ? "dia" : "dias"} lançados
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Faturamento" value={monthRevenue} />
            <Stat label="Média por dia" value={avgTicket} />
            <Stat label="Sobra/falta acumulada" value={monthDiff} tone="auto" />
            <Stat label="Pago a funcionários" value={monthPayroll} />
            <Stat label="Total livre" value={monthLivre} />
          </div>
        </section>

        {/* Grafico */}
        <section className="card">
          <h2 className="text-sm font-semibold text-muted">
            Faturamento — últimos {chart.length} dias lançados
          </h2>
          <div className="mt-3">
            <RevenueChart data={chart} />
          </div>
        </section>

        {/* Maiores diferencas */}
        {worst.length > 0 && (
          <section className="card">
            <h2 className="text-sm font-semibold text-muted">
              Maiores diferenças de caixa no mês
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {worst.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/caixa/${d.date}`} className="hover:text-brand">
                    {formatDateBR(d.date)} · {weekdayBR(d.date)}
                  </Link>
                  <span
                    className={`font-medium tabular-nums ${
                      Number(d.difference) >= 0 ? "text-pos" : "text-neg"
                    }`}
                  >
                    {formatBRL(Number(d.difference))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
