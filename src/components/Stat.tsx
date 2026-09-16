import { formatBRL } from "@/lib/calc";

export function Stat({
  label, value, hint, tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "pos" | "neg" | "auto";
}) {
  const numeric = typeof value === "number";
  const resolved =
    tone === "auto" && numeric
      ? Math.abs(value as number) < 0.01 ? "neutral" : (value as number) > 0 ? "pos" : "neg"
      : tone;
  const color =
    resolved === "pos" ? "text-pos" : resolved === "neg" ? "text-neg" : "text-ink";

  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>
        {numeric ? formatBRL(value as number) : value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
