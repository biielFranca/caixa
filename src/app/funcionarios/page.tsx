import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import MonthSelect from "@/components/MonthSelect";
import EmployeeManager from "@/components/EmployeeManager";
import { todayISO } from "@/lib/calc";
import type { Employee, Settings } from "@/lib/types";

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

export default async function FuncionariosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { mes } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : todayISO().slice(0, 7);

  const supabase = await createClient();

  const [empRes, shiftRes, setRes, allDaysRes, descRes] = await Promise.all([
    supabase.from("employees").select("*").order("active", { ascending: false }).order("name"),
    supabase
      .from("day_shifts")
      .select("employee_id, deliveries, amount, days!inner(date)")
      .gte("days.date", `${month}-01`)
      .lte("days.date", lastDayOfMonth(month)),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("days").select("date").order("date", { ascending: false }),
    supabase
      .from("descontos")
      .select("employee_id, amount")
      .gte("date", `${month}-01`)
      .lte("date", lastDayOfMonth(month)),
  ]);

  const shifts = (shiftRes.data ?? []) as {
    employee_id: string; deliveries: number | null; amount: number | null;
  }[];

  const totals: Record<
    string,
    { dias: number; entregas: number; bruto: number; desconto: number; valor: number }
  > = {};
  for (const s of shifts) {
    const t = (totals[s.employee_id] ??= { dias: 0, entregas: 0, bruto: 0, desconto: 0, valor: 0 });
    t.dias += 1;
    t.entregas += s.deliveries ?? 0;
    t.bruto += Number(s.amount ?? 0);
  }

  // Desconto de motoboy abate do que ele recebe. O da cozinha e so registro:
  // o valor da cozinha e do time inteiro, nao de cada pessoa.
  const byId = new Map(((empRes.data as Employee[]) ?? []).map((e) => [e.id, e]));
  for (const d of (descRes.data as { employee_id: string | null; amount: number }[]) ?? []) {
    if (!d.employee_id) continue;
    const t = (totals[d.employee_id] ??= { dias: 0, entregas: 0, bruto: 0, desconto: 0, valor: 0 });
    t.desconto += Number(d.amount);
  }
  for (const [id, t] of Object.entries(totals)) {
    const abate = byId.get(id)?.role === "entregador" ? t.desconto : 0;
    t.valor = Math.round((t.bruto - abate) * 100) / 100;
  }

  const months = Array.from(
    new Set(((allDaysRes.data as { date: string }[]) ?? []).map((d) => d.date.slice(0, 7)))
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Funcionários</h1>
          <MonthSelect month={month} months={months} basePath="/funcionarios" />
        </div>
        <EmployeeManager
          employees={(empRes.data as Employee[]) ?? []}
          totals={totals}
          settings={setRes.data as Settings}
          monthLabel={monthLabel(month)}
        />
      </main>
    </>
  );
}
