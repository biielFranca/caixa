import type { Employee, Entry, Method } from "./types";

/** Soma segura de valores monetarios (evita acumulo de erro de ponto flutuante). */
export function sum(values: number[]): number {
  return round(values.reduce((acc, v) => acc + (Number(v) || 0), 0));
}

export function round(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function totalByMethod(entries: Entry[], method: Method): number {
  return sum(entries.filter((e) => e.method === method).map((e) => e.amount));
}

export type DayTotals = {
  dinheiro: number;
  pix: number;
  cartao: number;
  /** TOTAL CADERNO: tudo que foi lancado durante o dia. */
  caderno: number;
  /** Valor bruto conferido no caixa, antes de descontar o fundo de troco. */
  caixaBruto: number;
  /** TOTAL CAIXA: o que realmente entrou, ja sem o fundo de troco inicial. */
  caixa: number;
  /** Positivo = sobra, negativo = falta. */
  diferenca: number;
};

/**
 * Replica a conferencia da planilha:
 *   TOTAL CADERNO = dinheiro + pix + cartao (lancamentos)
 *   TOTAL CAIXA   = (din contado + moeda contada + pix + cartao) - din inicial - moeda inicial
 *   DIFERENCA     = TOTAL CAIXA - TOTAL CADERNO
 */
export function dayTotals(
  entries: Entry[],
  opts: { cashOpen: number; coinOpen: number; countedCash: number; countedCoin: number }
): DayTotals {
  const dinheiro = totalByMethod(entries, "dinheiro");
  const pix = totalByMethod(entries, "pix");
  const cartao = totalByMethod(entries, "cartao");
  const caderno = round(dinheiro + pix + cartao);
  const caixaBruto = round(opts.countedCash + opts.countedCoin + pix + cartao);
  const caixa = round(caixaBruto - opts.cashOpen - opts.coinOpen);
  return { dinheiro, pix, cartao, caderno, caixaBruto, caixa, diferenca: round(caixa - caderno) };
}

/**
 * Pagamento do funcionario — replica exatamente a regra da planilha.
 *
 * Cozinha (ou qualquer um com valor fixo): valor fixo, nao depende de entregas.
 * Entregador: (entregas - entregas_livres) * valor_por_entrega + diaria.
 *
 * ATENCAO: nao existe piso. Assim como na planilha, entregas abaixo da franquia
 * reduzem o valor para baixo da diaria — (5 - 10) * 7 + 120 = 85. Quem nao
 * trabalhou no dia fica sem turno lancado (ou com entregas em branco) e recebe 0,
 * que e como a planilha zerava a linha na mao.
 */
export function shiftAmount(employee: Employee, deliveries: number | null): number {
  if (employee.role === "cozinha" || employee.fixed_amount != null) {
    return round(employee.fixed_amount ?? 0);
  }
  if (deliveries == null) return 0;
  return round((deliveries - employee.free_deliveries) * employee.per_delivery + employee.daily_rate);
}

export function formatBRL(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function weekdayBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function todayISO(): string {
  // Fuso de Sao Paulo: o fechamento pertence ao dia local, nao ao UTC.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
