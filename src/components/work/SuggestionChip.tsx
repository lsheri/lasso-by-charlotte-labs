import { Suggested, SuggestDot } from "@/components/common/Suggested";

/** A draft mapping, sitting inside the item's own card. Accept is a real button. */
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
    <Suggested className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <SuggestDot />
      <p className="min-w-0 flex-1 break-words text-xs text-ember-deep">
        <span className="font-medium">{label}</span>
        {reason ? <span className="text-muted-foreground"> — {reason}</span> : null}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onAccept}
          className="rounded-full bg-ember px-3 py-1 text-xs font-medium text-ember-foreground transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
    </Suggested>
  );
}
