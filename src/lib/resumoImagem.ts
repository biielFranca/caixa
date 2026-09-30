import { formatAmount, formatDateBR, weekdayBR } from "./calc";

export type ResumoLinha = {
  label: string;
  valor: number;
  detalhe?: string;
  obs?: string | null;
};

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
  observacoes?: string | null;
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

/** Quebra o texto em linhas que cabem na largura, respeitando quebras digitadas. */
function quebrarTexto(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\r?\n/)) {
    if (!paragrafo.trim()) { linhas.push(""); continue; }
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(tentativa).width <= largura) {
        atual = tentativa;
      } else {
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

/** Desenha o resumo do dia e devolve o PNG. */
export function desenharResumo(r: Resumo): Promise<Blob> {
  const secoes = [
    r.formas.length,
    2,
    r.funcionarios.length,
    r.canais.length,
  ];

  const obs = (r.observacoes ?? "").trim();
  const dpr = 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // A observacao e texto livre, entao a altura da imagem so e conhecida depois
  // de medir as linhas. Mede primeiro, dimensiona depois: redimensionar o canvas
  // limpa o desenho.
  ctx.font = `400 15px ${FONTE}`;
  const linhasObs = obs ? quebrarTexto(ctx, obs, W - PAD * 2) : [];

  // A observacao de cada funcionario tambem ocupa linha propria.
  ctx.font = `700 13px ${FONTE}`;
  const obsPorFuncionario = new Map<number, string[]>();
  r.funcionarios.forEach((f, i) => {
    const t = (f.obs ?? "").trim();
    if (t) obsPorFuncionario.set(i, quebrarTexto(ctx, t, W - PAD * 2 - 14));
  });
  const linhasObsFunc = [...obsPorFuncionario.values()].reduce((a, l) => a + l.length, 0);

  const altura =
    150 + // cabecalho
    secoes.reduce((a, n) => a + 54 + n * 34, 0) + // titulo + linhas de cada secao
    linhasObsFunc * 20 + // observacao por funcionario
    3 * 24 + // espacos entre secoes
    (linhasObs.length ? 24 + 54 + linhasObs.length * 24 : 0) + // observacoes do dia
    70; // rodape

  canvas.width = W * dpr;
  canvas.height = altura * dpr;
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
  r.funcionarios.forEach((l, i) => {
    linha(l);
    const notas = obsPorFuncionario.get(i);
    if (!notas) return;
    // Alinhada a direita, logo abaixo do valor a que se refere.
    ctx.font = `700 13px ${FONTE}`;
    ctx.fillStyle = COR.tinta;
    ctx.textAlign = "right";
    y -= 10;
    for (const t of notas) {
      ctx.fillText(t, W - PAD, y);
      y += 20;
    }
    ctx.textAlign = "left";
    y += 10;
  });
  y += 24;

  titulo("Total livre", r.totalLivre, r.totalLivre < 0 ? "neg" : "marca");
  r.canais.forEach((l) => linha(l));

  if (linhasObs.length) {
    y += 24;
    titulo("Observações");
    ctx.font = `400 15px ${FONTE}`;
    ctx.fillStyle = COR.tinta;
    for (const l of linhasObs) {
      ctx.fillText(l, PAD, y);
      y += 24;
    }
  }

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
