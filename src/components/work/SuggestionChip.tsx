import { Suggested, SuggestDot } from "@/components/common/Suggested";
import { DrawnCheck, DrawnStrike, useMark } from "@/components/notebook/marks";

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
  const check = useMark();
  const strike = useMark();
  return (
    <Suggested className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="relative flex items-center">
        <SuggestDot />
        {check.shown ? (
          <span className="pointer-events-none absolute -left-1 -top-1">
            <DrawnCheck key={check.markKey} size={16} />
          </span>
        ) : null}
      </span>
      <p className="relative min-w-0 flex-1 break-words text-xs text-ember-deep">
        {strike.shown ? <DrawnStrike key={strike.markKey} /> : null}
        <span className="font-medium">{label}</span>
        {reason ? <span className="text-muted-foreground">, {reason}</span> : null}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            check.fire();
            onAccept();
          }}
          className="rounded-full bg-ember px-3 py-1 text-xs font-medium text-ember-foreground transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => {
            strike.fire();
            onDismiss();
          }}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
    </Suggested>
  );
}
