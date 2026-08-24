import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import { spanStatusLabel, spanVerificationLine } from "@/lib/span-provenance-shared";
import { spanStatusClass } from "@/lib/span-status-style";

/**
 * One answered span: what the record supports, quoted verbatim or not at all.
 * Shared by the text sections and the rendered pages so both read identically,
 * and coloured by its status so the eye finds the strong ones first.
 */
export function StitchChip({
  stitch,
  onGoToSource,
  reduceMotion = false,
  lifted = false,
  onHoverChange,
}: {
  stitch: AuditStitch;
  onGoToSource: (stitch: AuditStitch) => void;
  reduceMotion?: boolean;
  /** True while its span is hovered in the other half of the pairing. */
  lifted?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}) {
  return (
    <div
      data-stitch-id={stitch.id}
      data-testid={`stitch-chip-${stitch.id}`}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={`mt-2 rounded-[var(--radius-md)] border border-border px-3 py-2 nb-stitch-chip ${spanStatusClass(
        stitch.status,
      )} ${reduceMotion ? "nb-pin-static" : "nb-pin-in"} ${lifted ? "nb-chip-lift" : ""}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] nb-stitch-status">
        {spanStatusLabel(stitch.status)}
        {stitch.to_item_title ? ` · ${stitch.to_item_title}` : ""}
        {stitch.to_turn_no ? ` · turn ${stitch.to_turn_no}` : ""}
      </p>
      {stitch.quote ? (
        <blockquote className="mt-1.5 border-l-2 pl-2 text-sm text-foreground nb-stitch-quote">
          {stitch.quote}
        </blockquote>
      ) : null}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {spanVerificationLine(stitch.verification, stitch.verification_note)}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {stitch.to_item_id ? (
          <button
            type="button"
            onClick={() => onGoToSource(stitch)}
            className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          >
            Show me where
          </button>
        ) : null}
        {stitch.to_item_url ? (
          <ChatUrlLink item={{ source_meta: { url: stitch.to_item_url } } as never} />
        ) : null}
        {stitch.asked_by_name ? (
          <span className="text-[11px] text-muted-foreground">Asked by {stitch.asked_by_name}</span>
        ) : null}
      </div>
    </div>
  );
}
