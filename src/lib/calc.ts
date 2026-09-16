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
 * Pagamento do funcionario.
 *
 * Cozinha (ou qualquer um com valor fixo): valor fixo, nao depende de entregas.
 * Entregador: a diaria e um piso. Ate a franquia de entregas ele recebe a diaria
 * cheia; so a partir da entrega seguinte cada uma soma o valor unitario.
 *
 *   ate 10 entregas  -> R$ 120
 *   11 entregas      -> R$ 127
 *   20 entregas      -> R$ 190
 *
 * A planilha antiga nao tinha esse piso e pagava (5 - 10) * 7 + 120 = 85 para
 * quem fizesse poucas entregas. Os turnos ja importados guardam o valor que foi
 * pago na epoca; a regra daqui vale para lancamento novo ou editado.
 *
 * Quem nao trabalhou nao tem turno lancado e recebe 0.
 */
export function shiftAmount(employee: Employee, deliveries: number | null): number {
  if (employee.role === "cozinha" || employee.fixed_amount != null) {
    return round(employee.fixed_amount ?? 0);
  }
  if (deliveries == null) return 0;
  const extras = Math.max(0, deliveries - employee.free_deliveries);
  return round(extras * employee.per_delivery + employee.daily_rate);
}

/**
 * Le um valor monetario digitado a mao, aceitando os dois formatos que o
 * caixa usa: "1.234,56" (pt-BR) e "1234.56". Vazio vira 0.
 */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  const raw = String(input ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  // Com virgula, ela e o separador decimal e o ponto e de milhar.
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Numero no formato pt-BR, sem o simbolo — o R$ fica fora do campo. */
export function formatAmount(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
