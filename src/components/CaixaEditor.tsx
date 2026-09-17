"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dayTotals, formatAmount, formatBRL, formatDateBR, parseMoney, round, shiftAmount, weekdayBR } from "@/lib/calc";
import { METHOD_LABEL, PLATFORMS, PLATFORM_LABEL } from "@/lib/types";
import type {
  Day, Desconto, Employee, Entry, Method, Platform, PlatformRevenue, Shift,
} from "@/lib/types";
import EntryColumn, { type DraftEntry } from "./EntryColumn";
import BotaoResumo from "./BotaoResumo";
import MoneyInput from "./MoneyInput";
import { Stat } from "./Stat";
import type { Resumo } from "@/lib/resumoImagem";

type Props = {
  date: string;
  day: Day;
  entries: Entry[];
  shifts: Shift[];
  employees: Employee[];
  platforms: PlatformRevenue[];
  descontos: Desconto[];
};

type ShiftDraft = {
  enabled: boolean;
  deliveries: string;
  amount: string;
  desconto: string;
  note: string;
};

const toNumber = parseMoney;

export default function CaixaEditor({
  date, day, entries, shifts, employees, platforms, descontos,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Estado local do fechamento: o router.refresh() do servidor leva alguns
  // segundos e no caixa isso vira clique repetido. Troca na hora, reconcilia depois.
  const [closedLocal, setClosedLocal] = useState(!!day.closed_at);
  const isClosed = closedLocal;
  // "fechando" e o passo em que o resto das informacoes aparece.
  const [step, setStep] = useState<"aberto" | "fechando">("aberto");
  const showAll = isClosed || step === "fechando";

  const motoboys = useMemo(() => employees.filter((e) => e.role === "entregador"), [employees]);
  // A folha da cozinha e uma linha so, do time inteiro. As pessoas da cozinha
  // existem para carregar desconto e nao tem valor individual.
  const cozinhaTime = useMemo(
    () => employees.find((e) => e.role !== "entregador" && Number(e.fixed_amount ?? 0) > 0) ?? null,
    [employees]
  );
  const cozinhaPessoas = useMemo(
    () => employees.filter((e) => e.role !== "entregador" && e.id !== cozinhaTime?.id),
    [employees, cozinhaTime]
  );
  const valorCozinha = round(Number(cozinhaTime?.fixed_amount ?? 0));

  const [cashOpen, setCashOpen] = useState(String(day.cash_open ?? 0));
  const [coinOpen, setCoinOpen] = useState(String(day.coin_open ?? 0));
  const [countedCash, setCountedCash] = useState(String(day.counted_cash ?? 0));
  const [countedCoin, setCountedCoin] = useState(String(day.counted_coin ?? 0));
  const [notes, setNotes] = useState(day.notes ?? "");

  const [draft, setDraft] = useState<Record<Method, DraftEntry[]>>(() => {
    const init: Record<Method, DraftEntry[]> = { dinheiro: [], pix: [], cartao: [] };
    entries.forEach((e) => init[e.method].push({ key: e.id, amount: Number(e.amount), note: e.note }));
    return init;
  });

  const [shiftDraft, setShiftDraft] = useState<Record<string, ShiftDraft>>(() => {
    const init: Record<string, ShiftDraft> = {};
    employees.forEach((emp) => {
      const s = shifts.find((x) => x.employee_id === emp.id);
      const computed = shiftAmount(emp, s?.deliveries ?? null);
      const isOverride = s?.amount != null && Math.abs(Number(s.amount) - computed) > 0.005;
      const desc = descontos
        .filter((d) => d.employee_id === emp.id)
        .reduce((a, d) => a + Number(d.amount), 0);
      init[emp.id] = {
        enabled: !!s,
        deliveries: s?.deliveries != null ? String(s.deliveries) : "",
        amount: isOverride ? String(s!.amount) : "",
        desconto: desc ? String(desc) : "",
        note: s?.note ?? "",
      };
    });
    return init;
  });

  const [platformDraft, setPlatformDraft] = useState<Record<Platform, string>>(() => {
    const init = {} as Record<Platform, string>;
    PLATFORMS.forEach((p) => {
      const found = platforms.find((x) => x.platform === p);
      init[p] = found ? String(found.amount) : "";
    });
    return init;
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Lancamento e gravado no instante em que entra. Guardar so em memoria ate um
  // botao de salvar significava perder o dia inteiro em qualquer recarga.
  async function adicionarLancamento(method: Method, amount: number) {
    const provisorio = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const posicao = draft[method].length;
    setDraft((d) => ({ ...d, [method]: [...d[method], { key: provisorio, amount, note: null }] }));

    const { data, error } = await supabase
      .from("entries")
      .insert({ day_id: day.id, method, amount, note: null, position: posicao })
      .select("id")
      .single();

    if (error || !data) {
      setDraft((d) => ({ ...d, [method]: d[method].filter((e) => e.key !== provisorio) }));
      setMessage({ kind: "err", text: "Não foi possível salvar o lançamento. Tente de novo." });
      return;
    }
    // Troca a chave provisoria pelo id real, que e o que o remover usa.
    setDraft((d) => ({
      ...d,
      [method]: d[method].map((e) => (e.key === provisorio ? { ...e, key: data.id } : e)),
    }));
    setMessage(null);
  }

  async function removerLancamento(method: Method, key: string) {
    const anterior = draft[method];
    setDraft((d) => ({ ...d, [method]: d[method].filter((e) => e.key !== key) }));

    const { error } = await supabase.from("entries").delete().eq("id", key);
    if (error) {
      setDraft((d) => ({ ...d, [method]: anterior }));
      setMessage({ kind: "err", text: "Não foi possível remover o lançamento." });
    }
  }

  // ---------------- totais ao vivo ----------------
  const totals = useMemo(() => {
    const flat = (["dinheiro", "pix", "cartao"] as Method[]).flatMap((m) =>
      draft[m].map((e) => ({ method: m, amount: e.amount } as Entry))
    );
    return dayTotals(flat, {
      cashOpen: toNumber(cashOpen), coinOpen: toNumber(coinOpen),
      countedCash: toNumber(countedCash), countedCoin: toNumber(countedCoin),
    });
  }, [draft, cashOpen, coinOpen, countedCash, countedCoin]);

  function pagamentoDe(emp: Employee) {
    const d = shiftDraft[emp.id];
    if (!d?.enabled) return { bruto: 0, desconto: 0, liquido: 0 };
    const bruto = d.amount.trim()
      ? toNumber(d.amount)
      : shiftAmount(emp, d.deliveries.trim() === "" ? null : Number(d.deliveries));
    // Desconto de cozinha e so registro: nao abate dos R$ 339 do time.
    const desconto = emp.role === "entregador" ? toNumber(d.desconto) : 0;
    return { bruto, desconto, liquido: round(bruto - desconto) };
  }

  // O que sai do bolso no fechamento: ja sem o que o motoboy retirou durante o dia.
  const folha = useMemo(
    () => round(motoboys.reduce((a, e) => a + pagamentoDe(e).liquido, 0) + valorCozinha),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shiftDraft, motoboys, valorCozinha]
  );

  // Custo cheio do dia, antes do desconto. O desconto ja saiu do caixa quando o
  // motoboy retirou, entao abater de novo contaria a mesma saida duas vezes.
  const folhaBruta = useMemo(
    () => round(motoboys.reduce((a, e) => a + pagamentoDe(e).bruto, 0) + valorCozinha),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shiftDraft, motoboys, valorCozinha]
  );
  // O caderno nao e digitado: e o que sobra do caixa depois de pagar o pessoal.
  // Mesma conta da planilha, onde a celula era =TOTAL_CAIXA - TOTAL_FUNCIONARIOS.
  const caderno = round(totals.caixa - folhaBruta);

  const livre = useMemo(
    () =>
      round(
        PLATFORMS.filter((p) => p !== "caderno").reduce(
          (a, p) => a + toNumber(platformDraft[p]),
          0
        ) + caderno
      ),
    [platformDraft, caderno]
  );

  // ---------------- persistencia ----------------
  async function persist(closing: boolean) {
    const { error: dayErr } = await supabase
      .from("days")
      .update({
        cash_open: toNumber(cashOpen),
        coin_open: toNumber(coinOpen),
        counted_cash: toNumber(countedCash),
        counted_coin: toNumber(countedCoin),
        notes: notes.trim() || null,
        needs_review: false,
        ...(closing ? { closed_at: new Date().toISOString() } : {}),
      })
      .eq("id", day.id);
    if (dayErr) throw dayErr;

    // Os lancamentos nao entram aqui: cada um ja foi gravado quando digitado.
    // Turnos, canais e descontos sao reescritos por inteiro, que e mais
    // previsivel do que calcular diferenca e o volume por dia e pequeno.
    if (closing) {
      const { error: delShifts } = await supabase.from("day_shifts").delete().eq("day_id", day.id);
      if (delShifts) throw delShifts;
      const shiftRows = motoboys
        .filter((e) => shiftDraft[e.id]?.enabled)
        .map((e) => {
          const d = shiftDraft[e.id];
          const deliveries = d.deliveries.trim() === "" ? null : Number(d.deliveries);
          return {
            day_id: day.id, employee_id: e.id, deliveries,
            amount: pagamentoDe(e).bruto, note: d.note.trim() || null,
          };
        });
      // A cozinha entra em todo dia fechado, sem marcacao: o valor e fixo.
      if (cozinhaTime) {
        shiftRows.push({
          day_id: day.id, employee_id: cozinhaTime.id, deliveries: null,
          amount: valorCozinha, note: null,
        });
      }
      if (shiftRows.length) {
        const { error } = await supabase.from("day_shifts").insert(shiftRows);
        if (error) throw error;
      }

      const { error: delPlat } = await supabase.from("platform_revenue").delete().eq("day_id", day.id);
      if (delPlat) throw delPlat;
      const platRows: { day_id: string; platform: Platform; amount: number }[] = PLATFORMS
        .filter((p) => p !== "caderno" && platformDraft[p].trim() !== "")
        .map((p) => ({ day_id: day.id, platform: p, amount: toNumber(platformDraft[p]) }));
      platRows.push({ day_id: day.id, platform: "caderno", amount: caderno });
      if (platRows.length) {
        const { error } = await supabase.from("platform_revenue").insert(platRows);
        if (error) throw error;
      }

      // Descontos do dia: so os dos motoboys saem daqui. Os de cozinha sao
      // lancados na tela de Descontos e nao podem ser apagados por este passo.
      const motoboyIds = motoboys.map((m) => m.id);
      if (motoboyIds.length) {
        const { error: delDesc } = await supabase
          .from("descontos").delete().eq("date", date).in("employee_id", motoboyIds);
        if (delDesc) throw delDesc;
      }
      const descRows = motoboys
        .filter((e) => shiftDraft[e.id]?.enabled && toNumber(shiftDraft[e.id].desconto) !== 0)
        .map((e) => ({
          employee_id: e.id, person: e.name, date,
          amount: toNumber(shiftDraft[e.id].desconto), note: null,
        }));
      if (descRows.length) {
        const { error } = await supabase.from("descontos").insert(descRows);
        if (error) throw error;
      }
    }
  }

  async function run(closing: boolean, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      await persist(closing);
      if (closing) setClosedLocal(true);
      setMessage({ kind: "ok", text: okText });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setBusy(false);
    }
  }

  async function reabrir() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("days").update({ closed_at: null }).eq("id", day.id);
    if (error) {
      setMessage({ kind: "err", text: error.message });
    } else {
      setClosedLocal(false);
      setStep("aberto");
      router.refresh();
    }
    setBusy(false);
  }

  const resumo: Resumo = useMemo(() => {
    const trabalharam = motoboys.filter((e) => shiftDraft[e.id]?.enabled);
    return {
      data: date,
      faturamento: totals.caderno,
      formas: [
        { label: "Dinheiro", valor: totals.dinheiro },
        { label: "Pix", valor: totals.pix },
        { label: "Cartão", valor: totals.cartao },
      ],
      totalCaixa: totals.caixa,
      diferenca: totals.diferenca,
      funcionarios: [
        ...(valorCozinha > 0 ? [{ label: "Cozinha", valor: valorCozinha }] : []),
        ...trabalharam.map((e) => {
          const d = shiftDraft[e.id];
          return {
            label: e.name,
            valor: pagamentoDe(e).liquido,
            detalhe: d.deliveries.trim() ? `${d.deliveries} entregas` : undefined,
          };
        }),
      ],
      totalPagar: folha,
      canais: [
        ...PLATFORMS.filter((p) => p !== "caderno").map((p) => ({
          label: PLATFORM_LABEL[p],
          valor: toNumber(platformDraft[p]),
        })),
        { label: "Caderno", valor: caderno },
      ],
      totalLivre: livre,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, totals, motoboys, shiftDraft, valorCozinha, folha, platformDraft, caderno, livre]);

  const diffTone =
    Math.abs(totals.diferenca) < 0.01 ? "neutral" : totals.diferenca > 0 ? "pos" : "neg";

  return (
    <div className="space-y-4">
      {/* Cabecalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{formatDateBR(date)}</h1>
          <p className="text-sm text-muted">
            {weekdayBR(date)} ·{" "}
            <span className={isClosed ? "text-muted" : "text-pos"}>
              {isClosed ? "caixa fechado" : "caixa aberto"}
            </span>
            {day.needs_review && " · importado da planilha, confira os valores"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {message && (
            <span className={`text-sm ${message.kind === "ok" ? "text-pos" : "text-neg"}`}>
              {message.text}
            </span>
          )}
          {showAll && <BotaoResumo resumo={resumo} />}
          {isClosed ? (
            <button onClick={reabrir} disabled={busy} className="btn-ghost">
              Reabrir caixa
            </button>
          ) : step === "aberto" ? (
            <button onClick={() => setStep("fechando")} disabled={busy} className="btn-primary">
              Fechar caixa
            </button>
          ) : (
            <>
              <button onClick={() => setStep("aberto")} disabled={busy} className="btn-ghost">
                Voltar
              </button>
              <button onClick={() => run(true, "Caixa fechado.")} disabled={busy} className="btn-primary">
                {busy ? "Fechando…" : "Confirmar fechamento"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lancamentos — sempre visiveis */}
      <fieldset disabled={isClosed} className="contents">
        <div className="grid gap-4 md:grid-cols-3">
          {(["dinheiro", "pix", "cartao"] as Method[]).map((m) => (
            <EntryColumn
              key={m} method={m} title={METHOD_LABEL[m]}
              entries={draft[m]} readOnly={isClosed}
              onAdd={(amount) => adicionarLancamento(m, amount)}
              onRemove={(key) => removerLancamento(m, key)}
            />
          ))}
        </div>
      </fieldset>

      {!showAll && (
        <p className="text-center text-sm text-muted">
          Cada lançamento é salvo na hora. Fundo de troco: {formatBRL(toNumber(cashOpen))} em dinheiro
          {toNumber(coinOpen) > 0 && ` e ${formatBRL(toNumber(coinOpen))} em moeda`}.
          O resto aparece ao fechar o caixa.
        </p>
      )}

      {showAll && (
        <>
          {/* Contagem */}
          <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Dinheiro inicial", value: cashOpen, set: setCashOpen },
              { label: "Moeda inicial", value: coinOpen, set: setCoinOpen },
              { label: "Dinheiro contado", value: countedCash, set: setCountedCash },
              { label: "Moeda contada", value: countedCoin, set: setCountedCoin },
            ].map((f) => (
              <div key={f.label} className="space-y-1">
                <label className="label">{f.label}</label>
                <MoneyInput
                  value={f.value} onChange={f.set} disabled={isClosed} ariaLabel={f.label}
                />
              </div>
            ))}
          </div>

          {/* Conferencia */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Total caderno" value={totals.caderno} hint="Tudo que foi lançado" />
            <Stat label="Total caixa" value={totals.caixa} hint="Conferido, sem o fundo de troco" />
            <Stat
              label={totals.diferenca >= 0 ? "Sobra" : "Falta"}
              value={totals.diferenca} hint="Caixa − caderno"
              tone={diffTone as "neutral" | "pos" | "neg"}
            />
          </div>

          {/* Motoboys */}
          <div className="card">
            <h3 className="font-semibold">Motoboys</h3>
            <p className="mt-1 text-xs text-muted">
              Até {motoboys[0]?.free_deliveries ?? 10} entregas o valor é a diária.
              A partir da seguinte, cada entrega soma.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-2">Trabalhou</th>
                    <th className="py-2 pr-2">Nome</th>
                    <th className="py-2 pr-2">Entregas</th>
                    <th className="py-2 pr-2 text-right">Valor</th>
                    <th className="py-2 pr-2">Desconto</th>
                    <th className="py-2 pr-2 text-right">A pagar</th>
                    <th className="py-2">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {motoboys.map((emp) => {
                    const d = shiftDraft[emp.id];
                    const pg = pagamentoDe(emp);
                    const update = (patch: Partial<ShiftDraft>) =>
                      setShiftDraft((s) => ({ ...s, [emp.id]: { ...s[emp.id], ...patch } }));
                    return (
                      <tr key={emp.id} className="border-b border-line/60">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox" checked={d.enabled} disabled={isClosed}
                            onChange={(e) => update({ enabled: e.target.checked })}
                            aria-label={`${emp.name} trabalhou`}
                            className="size-4 accent-[rgb(var(--brand))]"
                          />
                        </td>
                        <td className="py-2 pr-2">{emp.name}</td>
                        <td className="py-2 pr-2">
                          <input
                            className="input w-20 tabular-nums" inputMode="numeric"
                            value={d.deliveries} disabled={!d.enabled || isClosed}
                            onChange={(e) => update({ deliveries: e.target.value })}
                            aria-label={`Entregas de ${emp.name}`}
                          />
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-muted">
                          {d.enabled ? formatBRL(pg.bruto) : "—"}
                        </td>
                        <td className="py-2 pr-2">
                          <div className="w-28">
                            <MoneyInput
                              value={d.desconto} disabled={!d.enabled || isClosed}
                              onChange={(v) => update({ desconto: v })}
                              ariaLabel={`Desconto de ${emp.name}`}
                            />
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right font-medium tabular-nums">
                          {d.enabled ? formatBRL(pg.liquido) : "—"}
                        </td>
                        <td className="py-2">
                          <input
                            className="input min-w-28" value={d.note} disabled={!d.enabled || isClosed}
                            onChange={(e) => update({ note: e.target.value })}
                            aria-label={`Observação de ${emp.name}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cozinha — valor fixo do time, sem marcacao individual */}
          <div className="card">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">Cozinha</h3>
              <span className="text-lg font-semibold tabular-nums">{formatBRL(valorCozinha)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Valor do time inteiro, lançado em todo fechamento. Para alterar, edite em
              Funcionários. Desconto individual é lançado em Descontos e não abate daqui.
            </p>
            {cozinhaPessoas.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                {cozinhaPessoas.map((e) => e.name).join(" · ")}
              </p>
            )}
          </div>

          <div className="card flex items-baseline justify-between">
            <span className="label">Total a pagar no dia</span>
            <span className="text-lg font-semibold tabular-nums">{formatBRL(folha)}</span>
          </div>

          {/* Canais + observacoes */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">Total livre</h3>
                <span className="text-lg font-semibold tabular-nums">{formatBRL(livre)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Soma dos canais.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {PLATFORMS.filter((p) => p !== "caderno").map((p) => (
                  <div key={p} className="space-y-1">
                    <label className="label">{PLATFORM_LABEL[p]}</label>
                    <MoneyInput
                      value={platformDraft[p]} disabled={isClosed}
                      onChange={(v) => setPlatformDraft((s) => ({ ...s, [p]: v }))}
                      ariaLabel={PLATFORM_LABEL[p]}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="label">Caderno</label>
                  <div
                    className={`input flex items-center justify-between tabular-nums ${
                      caderno < 0 ? "text-neg" : ""
                    }`}
                    aria-label="Caderno"
                  >
                    <span className="text-sm text-muted">R$</span>
                    <span>{formatAmount(caderno)}</span>
                  </div>
                  <p className="text-xs text-muted">Total caixa − funcionários, sem desconto</p>
                </div>
              </div>
            </div>
            <div className="card">
              <h3 className="font-semibold">Observações do dia</h3>
              <textarea
                className="input mt-3 min-h-28 resize-y" value={notes} disabled={isClosed}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações, ocorrências, quebras de caixa…"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
