import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import DescontosManager from "@/components/DescontosManager";
import type { Desconto, Employee } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DescontosPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [descontosRes, empRes] = await Promise.all([
    supabase.from("descontos").select("*").order("date", { ascending: false }),
    supabase.from("employees").select("*").eq("active", true).order("role").order("name"),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-semibold">Descontos</h1>
          <p className="text-sm text-muted">Valores retirados por cada pessoa.</p>
        </div>
        <DescontosManager
          descontos={(descontosRes.data as Desconto[]) ?? []}
          employees={(empRes.data as Employee[]) ?? []}
        />
      </main>
    </>
  );
}
