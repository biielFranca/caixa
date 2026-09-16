import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, requireUser } from "@/lib/supabase/server";
import CaixaEditor from "@/components/CaixaEditor";
import Nav from "@/components/Nav";
import type { Day, Employee, Entry, PlatformRevenue, Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default async function CaixaDiaPage({
  params,
}: {
  params: Promise<{ data: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { data: date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/caixa");

  const supabase = await createClient();

  const { data: day } = await supabase
    .from("days").select("*").eq("date", date).maybeSingle();

  const [entriesRes, shiftsRes, platformsRes, employeesRes] = await Promise.all([
    day
      ? supabase.from("entries").select("*").eq("day_id", day.id).order("position")
      : Promise.resolve({ data: [] as Entry[] }),
    day
      ? supabase.from("day_shifts").select("*").eq("day_id", day.id)
      : Promise.resolve({ data: [] as Shift[] }),
    day
      ? supabase.from("platform_revenue").select("*").eq("day_id", day.id)
      : Promise.resolve({ data: [] as PlatformRevenue[] }),
    supabase.from("employees").select("*").eq("active", true).order("role").order("name"),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between text-sm">
          <Link href={`/caixa/${shiftDate(date, -1)}`} className="btn-ghost">
            ← Dia anterior
          </Link>
          <Link href={`/caixa/${shiftDate(date, 1)}`} className="btn-ghost">
            Próximo dia →
          </Link>
        </div>

        <CaixaEditor
          date={date}
          day={(day as Day) ?? null}
          entries={(entriesRes.data as Entry[]) ?? []}
          shifts={(shiftsRes.data as Shift[]) ?? []}
          platforms={(platformsRes.data as PlatformRevenue[]) ?? []}
          employees={(employeesRes.data as Employee[]) ?? []}
        />
      </main>
    </>
  );
}
