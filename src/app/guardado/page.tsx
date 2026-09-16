import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import SavingsManager from "@/components/SavingsManager";
import type { Saving } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GuardadoPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [savingsRes, empRes] = await Promise.all([
    supabase.from("savings").select("*").order("date", { ascending: false }),
    supabase.from("employees").select("name").eq("active", true).order("name"),
  ]);

  const savings = (savingsRes.data as Saving[]) ?? [];
  const people = Array.from(
    new Set([
      ...savings.map((s) => s.person),
      ...((empRes.data as { name: string }[]) ?? []).map((e) => e.name),
    ])
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-semibold">Dinheiro guardado</h1>
          <p className="text-sm text-muted">Quanto cada pessoa tem guardado no caixa.</p>
        </div>
        <SavingsManager savings={savings} people={people} />
      </main>
    </>
  );
}
