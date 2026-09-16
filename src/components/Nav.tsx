"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Painel" },
  { href: "/caixa", label: "Caixa" },
  { href: "/historico", label: "Histórico" },
  { href: "/funcionarios", label: "Funcionários" },
  { href: "/descontos", label: "Descontos" },
  { href: "/config", label: "Config" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2">
        <span className="mr-2 shrink-0 text-sm font-semibold">Caixa</span>
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                active ? "bg-brand text-white" : "text-muted hover:bg-bg hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <button onClick={logout} className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted hover:text-neg">
          Sair
        </button>
      </div>
    </header>
  );
}
