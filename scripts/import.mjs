/**
 * Importa data/extract.json (gerado por scripts/extract.py) para o Supabase.
 *
 *   node scripts/import.mjs            # importa
 *   node scripts/import.mjs --reset    # apaga tudo antes de importar
 *
 * Exige SUPABASE_SERVICE_ROLE_KEY: o import escreve direto, sem sessao de usuario.
 * Essa chave ignora RLS — use so localmente, nunca na Vercel.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import "dotenv/config";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const RESET = process.argv.includes("--reset");

const slugify = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
   .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function insertAll(table, rows, size = 500) {
  for (const part of chunk(rows, size)) {
    const { error } = await db.from(table).insert(part);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  const { days, savings } = JSON.parse(readFileSync("data/extract.json", "utf8"));
  console.log(`lendo ${days.length} dias, ${savings.length} registros de guardado`);

  if (RESET) {
    console.log("apagando dados existentes…");
    // days em cascata leva entries, day_shifts e platform_revenue junto.
    for (const t of ["savings", "days", "employees"]) {
      const { error } = await db.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw new Error(`reset ${t}: ${error.message}`);
    }
  }

  const { data: settings } = await db.from("settings").select("*").eq("id", 1).single();

  // ---------- funcionarios (deduplicados por slug) ----------
  const seen = new Map();
  for (const d of days) {
    for (const s of d.shifts) {
      const slug = slugify(s.name);
      if (!slug || seen.has(slug)) continue;
      const kitchen = s.is_kitchen;
      seen.set(slug, {
        name: s.name.replace(/\s+/g, " ").trim(),
        slug,
        role: kitchen ? "cozinha" : "entregador",
        daily_rate: settings.default_daily_rate,
        per_delivery: settings.default_per_delivery,
        free_deliveries: settings.default_free_deliveries,
        fixed_amount: kitchen ? settings.kitchen_amount : null,
        // Só fica ativo quem aparece nos últimos 60 dias — a planilha acumulou
        // dezenas de nomes que já não trabalham mais.
        active: false,
      });
    }
  }
  const recent = new Set(
    days.slice(-60).flatMap((d) => d.shifts.map((s) => slugify(s.name)))
  );
  for (const [slug, emp] of seen) emp.active = recent.has(slug);

  const employees = [...seen.values()];
  await insertAll("employees", employees);
  console.log(`funcionarios: ${employees.length} (${employees.filter((e) => e.active).length} ativos)`);

  const { data: savedEmp } = await db.from("employees").select("id, slug");
  const empId = new Map(savedEmp.map((e) => [e.slug, e.id]));

  // ---------- dias ----------
  const dayRows = days.map((d) => ({
    date: d.date,
    cash_open: d.cash_open,
    coin_open: d.coin_open,
    counted_cash: d.counted_cash,
    counted_coin: d.counted_coin,
    needs_review: d.needs_review,
    source_sheet: d.source_sheet,
    notes: d.warnings.length ? `Importação: ${d.warnings.join("; ")}` : null,
    closed_at: null,
  }));
  await insertAll("days", dayRows);
  console.log(`dias: ${dayRows.length}`);

  const { data: savedDays } = await db.from("days").select("id, date");
  const dayId = new Map(savedDays.map((d) => [d.date, d.id]));

  // ---------- lancamentos ----------
  const entries = days.flatMap((d) =>
    d.entries.map((e, i) => ({
      day_id: dayId.get(d.date), method: e.method, amount: e.amount, note: e.note, position: i,
    }))
  );
  await insertAll("entries", entries, 1000);
  console.log(`lancamentos: ${entries.length}`);

  // ---------- turnos ----------
  const shifts = [];
  const skipped = [];
  for (const d of days) {
    const used = new Set();
    for (const s of d.shifts) {
      const id = empId.get(slugify(s.name));
      // A planilha repetia o mesmo nome no mesmo dia; o banco tem unique(dia, funcionario).
      if (!id || used.has(id)) { skipped.push(`${d.date} ${s.name}`); continue; }
      used.add(id);
      shifts.push({
        day_id: dayId.get(d.date),
        employee_id: id,
        deliveries: s.deliveries,
        amount: s.amount ?? 0,
        note: s.note,
      });
    }
  }
  await insertAll("day_shifts", shifts, 1000);
  console.log(`turnos: ${shifts.length}${skipped.length ? ` (${skipped.length} duplicados ignorados)` : ""}`);

  // ---------- plataformas ----------
  const platforms = days.flatMap((d) => {
    const used = new Set();
    return d.platforms.filter((p) => !used.has(p.platform) && used.add(p.platform))
      .map((p) => ({ day_id: dayId.get(d.date), platform: p.platform, amount: p.amount }));
  });
  await insertAll("platform_revenue", platforms, 1000);
  console.log(`faturamento por canal: ${platforms.length}`);

  // ---------- guardado ----------
  await insertAll("savings", savings.map((s) => ({
    person: s.person, date: s.date, amount: s.amount, note: s.note,
  })));
  console.log(`dinheiro guardado: ${savings.length}`);

  console.log("\nimportacao concluida.");
}

main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });
