export function SuggestionChip({
  label,
  reason,
  onAccept,
  onDismiss,
  pending,
}: {
  label: string;
  reason: string;
  onAccept: () => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-accent-soft/60 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-xs text-accent-deep">
        → {label}
        {reason ? <span className="text-muted-foreground"> — {reason}</span> : null}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={onAccept}
        className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
      >
        Accept
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss suggestion"
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}
