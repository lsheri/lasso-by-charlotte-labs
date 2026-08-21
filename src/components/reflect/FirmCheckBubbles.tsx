import type { FirmCheck } from "@/hooks/use-firm-checks";

/**
 * Pass 92: a firm check is its own selectable analysis, one bubble per check.
 * The accent (blue) treatment is what tells a reader "this is your firm's
 * knowledge", against the neutral outline of Lasso's own analyses. Same size,
 * same shape, same typography: they are obviously the same kind of control.
 */
export const FIRM_CHECK_BUBBLE_CLASS =
  "max-w-[220px] truncate rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs font-medium text-foreground transition-opacity hover:opacity-85 disabled:opacity-50";

/** The label for the bubble that runs every applicable check in one go. */
export function runAllChecksLabel(count: number): string {
  return count === 1 ? "Run all 1 check" : `Run all ${count} checks`;
}

/**
 * The bubbles for one target: one per active check, then the run all bubble
 * that keeps today's behaviour reachable. Selecting one never runs anything on
 * its own; the caller opens the confirm step exactly as the stock chips do.
 */
export function FirmCheckBubbles({
  checks,
  disabled = false,
  reason,
  onPick,
}: {
  checks: readonly FirmCheck[];
  disabled?: boolean;
  reason?: string | null;
  onPick: (check: FirmCheck | null) => void;
}) {
  if (checks.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {checks.map((check) => (
        <button
          key={check.id}
          type="button"
          disabled={disabled}
          title={reason ?? check.title}
          onClick={() => onPick(check)}
          className={FIRM_CHECK_BUBBLE_CLASS}
        >
          {check.title}
        </button>
      ))}
      {checks.length > 1 ? (
        <button
          type="button"
          disabled={disabled}
          title={reason ?? undefined}
          onClick={() => onPick(null)}
          className={FIRM_CHECK_BUBBLE_CLASS}
        >
          {runAllChecksLabel(checks.length)}
        </button>
      ) : null}
    </div>
  );
}
