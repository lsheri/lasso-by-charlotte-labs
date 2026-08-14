import { Info } from "lucide-react";
import { useState } from "react";

import {
  GROUNDING_LINE,
  type AnalysisPreset,
} from "@/lib/analysis-presets";

/**
 * Credibility, drawn from real run state rather than described in the abstract:
 * what was read, what is looked for, what will never happen, and where the
 * thinking comes from.
 */
export function AnalysisInfoPanel({
  preset,
  readsDetail,
  iconOnly = false,
}: {
  preset: AnalysisPreset;
  readsDetail: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={iconOnly ? "How this works" : undefined}
        title={iconOnly ? "How this works" : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Info className="h-3 w-3" aria-hidden />
        {iconOnly ? null : "How this works"}
      </button>

      {open ? (
        <div className="mt-2 space-y-3 rounded-[var(--radius-md)] border border-border bg-secondary/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          {iconOnly ? <p className="micro-label">How this works</p> : null}
          <div>
            <p className="micro-label">What it reads</p>
            <p className="mt-1 text-foreground">{preset.infoPanel.reads(readsDetail)}</p>
          </div>
          <div>
            <p className="micro-label">What it looks for</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {preset.infoPanel.looksFor.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="micro-label">What it will never do</p>
            <p className="mt-1">{preset.infoPanel.never}</p>
          </div>
          <div>
            <p className="micro-label">Where it comes from</p>
            <p className="mt-1">{GROUNDING_LINE}</p>
            <ul className="mt-1.5 space-y-1">
              {preset.infoPanel.sources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent-deep hover:underline"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
            {preset.attribution ? <p className="mt-2">{preset.attribution}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}