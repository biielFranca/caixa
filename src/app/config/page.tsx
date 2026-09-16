import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import SettingsForm from "@/components/SettingsForm";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [setRes, reviewRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("days").select("date, source_sheet").eq("needs_review", true).order("date"),
  ]);

  const review = (reviewRes.data as { date: string; source_sheet: string | null }[]) ?? [];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-5">
        <h1 className="text-xl font-semibold">Configuração</h1>

        <SettingsForm settings={setRes.data as Settings} />

        <section className="card">
          <h2 className="font-semibold">Dias importados a revisar</h2>
          <p className="mt-1 text-sm text-muted">
            Vieram da planilha antiga com data incerta ou soma sem fórmula. Abra, confira
            e salve — ao salvar, a marcação some.
          </p>
          {review.length === 0 ? (
            <p className="mt-3 text-sm text-pos">Nada pendente.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {review.map((d) => (
                <a
                  key={d.date} href={`/caixa/${d.date}`}
                  className="rounded-lg border border-line px-2.5 py-1 text-sm hover:border-brand hover:text-brand"
                  title={d.source_sheet ?? undefined}
                >
                  {d.date.split("-").reverse().join("/")}
                </a>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold">Conta</h2>
          <p className="mt-1 text-sm text-muted">Sessão de {user.email}.</p>
        </section>
      </main>
    </>
  );
}
