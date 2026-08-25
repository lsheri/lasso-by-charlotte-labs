import { LEGEND_LINE } from "@/lib/span-readability";

/**
 * The colours, explained once, at the top of the answer rail. Quiet, always on,
 * never hidden behind a tooltip: a person should never have to guess what amber
 * meant.
 */
export function SpanLegend() {
  return (
    <p
      data-testid="span-legend"
      className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground"
    >
      <span aria-hidden className="flex shrink-0 items-center gap-1">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--status-exact)" }}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--status-paraphrase)" }}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--status-unsourced)" }}
        />
      </span>
      {LEGEND_LINE}
    </p>
  );
}
