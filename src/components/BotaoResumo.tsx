"use client";

import { useEffect, useRef, useState } from "react";
import { desenharResumo, type Resumo } from "@/lib/resumoImagem";

type Estado = "parado" | "gerando" | "copiado" | "baixado";

function suportaCopiarImagem() {
  return (
    typeof window !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    !!navigator.clipboard?.write
  );
}

/**
 * Copia o resumo do dia para a area de transferencia, pronto para colar no
 * WhatsApp. Se o navegador nao souber copiar imagem, baixa o arquivo.
 */
export default function BotaoResumo({ resumo }: { resumo: Resumo }) {
  const [estado, setEstado] = useState<Estado>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function avisar(e: Estado) {
    setEstado(e);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado("parado"), 2500);
  }

  async function baixar(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caixa-${resumo.data}.png`;
    a.click();
    URL.revokeObjectURL(url);
    avisar("baixado");
  }

  async function copiar() {
    setEstado("gerando");
    setErro(null);
    try {
      if (suportaCopiarImagem()) {
        // O ClipboardItem recebe a promessa, e nao o blob pronto: o Safari
        // exige que ele seja criado ainda dentro do clique.
        const item = new ClipboardItem({ "image/png": desenharResumo(resumo) });
        try {
          await navigator.clipboard.write([item]);
          avisar("copiado");
          return;
        } catch {
          // Permissao negada ou navegador sem suporte real: cai no download.
        }
      }
      await baixar(await desenharResumo(resumo));
    } catch (e) {
      setEstado("parado");
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a imagem.");
    }
  }

  const texto = {
    parado: "Copiar imagem",
    gerando: "Gerando…",
    copiado: "Copiado!",
    baixado: "Baixado",
  }[estado];

  return (
    <>
      <button
        onClick={copiar}
        disabled={estado === "gerando"}
        className={estado === "copiado" ? "btn-primary" : "btn-ghost"}
      >
        {texto}
      </button>
      {erro && <span className="text-sm text-neg">{erro}</span>}
    </>
  );
}
