"use client";

import { useState } from "react";
import { formatAmount, parseMoney } from "@/lib/calc";

/**
 * Campo de dinheiro com R$ fixo a esquerda.
 *
 * Em foco mostra o texto cru, para digitar sem atrapalhar; fora de foco mostra
 * o valor formatado. O valor guardado continua string, para o campo poder ficar
 * vazio — e vazio e diferente de zero em boa parte das telas.
 */
export default function MoneyInput({
  value, onChange, disabled, className = "", placeholder = "0,00", ariaLabel, id,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const display = focused || value.trim() === "" ? value : formatAmount(parseMoney(value));

  return (
    <div className="relative">
      <span
        aria-hidden
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
          disabled ? "text-muted/50" : "text-muted"
        }`}
      >
        R$
      </span>
      <input
        id={id}
        className={`input pl-9 text-right tabular-nums ${className}`}
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={display}
        onFocus={(e) => {
          setFocused(true);
          // Zero na abertura do campo so atrapalha: digitar 300 viraria 0300.
          if (parseMoney(e.target.value) === 0) {
            onChange("");
            return;
          }
          // Sincrono de proposito: adiar isso para o proximo frame faz o select
          // cair em cima do que ja foi digitado e comer os primeiros caracteres.
          e.target.select();
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
