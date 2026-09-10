import type { ReactNode } from "react";

/**
 * Figma Card (10:22). Tone is meaning, not decoration:
 * paper = a fact, claim = your call, record = on the record,
 * attention = unverified, source = where it came from.
 *
 * Deliberate deviation: Figma type/micro is 9px. Production floors mono
 * uppercase at 10px for readability, consistent with the micro-label call
 * recorded earlier in the port.
 */
export type CardTone = "paper" | "claim" | "record" | "attention";

const TONE: Record<CardTone, string> = {
  paper: "bg-card border-[var(--nb-pencil)]",
  claim: "bg-[var(--nb-yellow-wash)] border-[var(--nb-yellow-edge)]",
  record: "bg-[var(--nb-green-wash)] border-[var(--nb-green)]",
  attention: "bg-[var(--nb-amber-wash)] border-[var(--nb-amber-edge)]",
};

const LABEL_TONE: Record<CardTone, string> = {
  paper: "text-soft",
  claim: "text-[var(--nb-yellow-ink)]",
  record: "text-soft",
  attention: "text-soft",
};

export function ToneCard({
  tone = "paper",
  label,
  title,
  meta,
  mark,
  className = "",
}: {
  tone?: CardTone;
  label?: string;
  title: string;
  meta?: string;
  /** Small source mark, rendered at the end of the label row. */
  mark?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-[var(--radius-control)] border px-3 py-2.5 ${TONE[tone]} ${className}`}
    >
      {label || mark ? (
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.08em] ${LABEL_TONE[tone]}`}
          >
            {label}
          </span>
          {mark ? <span className="shrink-0">{mark}</span> : null}
        </div>
      ) : null}

      <span className="text-[13px] font-medium leading-[17px] text-foreground">{title}</span>

      {meta ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">{meta}</span>
      ) : null}
    </div>
  );
}
