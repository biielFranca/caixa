import { formatAmount, formatDateBR, weekdayBR } from "./calc";

export type ResumoLinha = { label: string; valor: number; detalhe?: string };

export type Resumo = {
  data: string;
  faturamento: number;
  formas: ResumoLinha[];
  totalCaixa: number;
  diferenca: number;
  funcionarios: ResumoLinha[];
  totalPagar: number;
  canais: ResumoLinha[];
  totalLivre: number;
};

const W = 720;
const PAD = 40;
const COR = {
  fundo: "#ffffff",
  tinta: "#1c1917",
  fraca: "#78716c",
  linha: "#e7e5e4",
  marca: "#0d9488",
  neg: "#be123c",
};
const FONTE = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Desenha o resumo do dia e devolve o PNG. */
export function desenharResumo(r: Resumo): Promise<Blob> {
  const secoes = [
    r.formas.length,
    2,
    r.funcionarios.length,
    r.canais.length,
  ];
  const altura =
    150 + // cabecalho
    secoes.reduce((a, n) => a + 54 + n * 34, 0) + // titulo + linhas de cada secao
    3 * 24 + // espacos entre secoes
    70; // rodape

  const dpr = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = altura * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, W, altura);

  let y = 0;

  // ---------- cabecalho ----------
  ctx.fillStyle = COR.marca;
  ctx.fillRect(0, 0, W, 108);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 15px ${FONTE}`;
  ctx.fillText("FECHAMENTO DE CAIXA", PAD, 44);
  ctx.font = `700 30px ${FONTE}`;
  ctx.fillText(`${weekdayBR(r.data)}, ${formatDateBR(r.data)}`, PAD, 82);
  y = 108 + 42;

  const money = (n: number) => `${n < 0 ? "-" : ""}R$ ${formatAmount(Math.abs(n))}`;

  function titulo(texto: string, total?: number, tone?: "neg" | "marca") {
    ctx.font = `600 13px ${FONTE}`;
    ctx.fillStyle = COR.fraca;
    ctx.fillText(texto.toUpperCase(), PAD, y);
    if (total !== undefined) {
      ctx.font = `700 22px ${FONTE}`;
      ctx.fillStyle = tone === "neg" ? COR.neg : tone === "marca" ? COR.marca : COR.tinta;
      ctx.textAlign = "right";
      ctx.fillText(money(total), W - PAD, y + 3);
      ctx.textAlign = "left";
    }
    y += 30;
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 8);
    ctx.lineTo(W - PAD, y - 8);
    ctx.stroke();
    y += 16;
  }

  function linha({ label, valor, detalhe }: ResumoLinha, destaque = false) {
    ctx.font = `${destaque ? "600" : "400"} 16px ${FONTE}`;
    ctx.fillStyle = destaque ? COR.tinta : COR.fraca;
    ctx.fillText(label, PAD + (destaque ? 0 : 14), y);
    if (detalhe) {
      const larguraLabel = ctx.measureText(label).width;
      ctx.font = `400 13px ${FONTE}`;
      ctx.fillStyle = COR.fraca;
      ctx.fillText(detalhe, PAD + 14 + larguraLabel + 10, y);
    }
    ctx.font = `${destaque ? "700" : "500"} 16px ${FONTE}`;
    ctx.fillStyle = valor < 0 ? COR.neg : COR.tinta;
    ctx.textAlign = "right";
    ctx.fillText(money(valor), W - PAD, y);
    ctx.textAlign = "left";
    y += 34;
  }

  titulo("Faturamento", r.faturamento, "marca");
  r.formas.forEach((l) => linha(l));
  y += 24;

  titulo("Conferência");
  linha({ label: "Total no caixa", valor: r.totalCaixa });
  linha({ label: r.diferenca >= 0 ? "Sobra" : "Falta", valor: r.diferenca });
  y += 24;

  titulo("Funcionários", r.totalPagar);
  r.funcionarios.forEach((l) => linha(l));
  y += 24;

  titulo("Total livre", r.totalLivre, r.totalLivre < 0 ? "neg" : "marca");
  r.canais.forEach((l) => linha(l));

  // ---------- rodape ----------
  ctx.font = `400 12px ${FONTE}`;
  ctx.fillStyle = COR.fraca;
  ctx.fillText(
    `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    PAD,
    altura - 28
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem."))),
      "image/png"
    )
  );
}
