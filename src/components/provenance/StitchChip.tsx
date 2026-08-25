import { StitchBadge } from "@/components/provenance/StitchBadge";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { SourceMark } from "@/components/work/SourceMark";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import { spanVerificationLine } from "@/lib/span-provenance-shared";
import { showMeLabel, spanStatusPhrase } from "@/lib/span-readability";
import { spanStatusClass } from "@/lib/span-status-style";

/**
 * One answered question, read as a sentence rather than as metadata: what the
 * record supports, where it came from, and the quote itself. Shared by the text
 * sections and the rendered pages so both read identically, and coloured by its
 * status so the eye finds the strong ones first.
 */
export function StitchChip({
  stitch,
  onGoToSource,
  reduceMotion = false,
  lifted = false,
  onHoverChange,
  number,
  onBadgeClick,
  sourceVendor = null,
}: {
  stitch: AuditStitch;
  onGoToSource: (stitch: AuditStitch) => void;
  reduceMotion?: boolean;
  /** True while its span is hovered in the other half of the pairing. */
  lifted?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  /** The pairing number, by when the question was asked. */
  number?: number;
  onBadgeClick?: () => void;
  sourceVendor?: string | null;
}) {
  return (
    <div
      data-stitch-id={stitch.id}
      data-testid={`stitch-chip-${stitch.id}`}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={`mt-2 rounded-[var(--radius-md)] border border-border px-3 py-2 nb-stitch-chip ${spanStatusClass(
        stitch.status,
      )} ${reduceMotion ? "nb-chip-enter-static" : "nb-chip-enter"} ${lifted && !reduceMotion ? "nb-chip-lift" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {number ? (
          <StitchBadge
            n={number}
            stitchId={stitch.id}
            where="card"
            filled={lifted}
            {...(onBadgeClick ? { onClick: onBadgeClick } : {})}
          />
        ) : null}
        <span className="text-sm font-medium nb-stitch-status">
          {spanStatusPhrase(stitch.status)}
        </span>
        {stitch.to_item_title ? (
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            from
            {sourceVendor ? <SourceMark item={{ source_vendor: sourceVendor }} size={12} /> : null}
            <span className="min-w-0 truncate text-foreground">{stitch.to_item_title}</span>
          </span>
        ) : null}
      </div>

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
            {showMeLabel(stitch)}
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
