"use client";

import { useState } from "react";
import { desenharResumo, type Resumo } from "@/lib/resumoImagem";

/**
 * Gera o resumo do dia como PNG. No celular abre o compartilhamento do
 * sistema, que e como isso chega no WhatsApp; no resto baixa o arquivo.
 */
export default function BotaoResumo({ resumo }: { resumo: Resumo }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setBusy(true);
    setErro(null);
    try {
      const blob = await desenharResumo(resumo);
      const nome = `caixa-${resumo.data}.png`;
      const file = new File([blob], nome, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Caixa ${resumo.data}` });
          return;
        } catch (e) {
          // Cancelar o compartilhamento nao e erro: so nao faz nada.
          if (e instanceof DOMException && e.name === "AbortError") return;
          // Qualquer outra falha cai no download abaixo.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={gerar} disabled={busy} className="btn-ghost">
        {busy ? "Gerando…" : "Exportar imagem"}
      </button>
      {erro && <span className="text-sm text-neg">{erro}</span>}
    </>
  );
}
