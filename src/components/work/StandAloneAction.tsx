import { useProfile } from "@/hooks/use-profile";
import { useStandAlone } from "@/components/work/use-stand-alone";
import { ownsWorkItem } from "@/lib/work-ownership";
import {
  PUT_BACK_LABEL,
  STAND_ALONE_LABEL,
  canGoBackToChat,
  canStandAlone,
} from "@/lib/work-standalone";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * W2: one artifact inside a pushed conversation is sometimes the work. This
 * lets its owner say so, and say the opposite again afterwards. Nothing is
 * created and nothing is lost either way.
 *
 * Only the owner sees it, because only the owner can write it. A transcript
 * never offers it: a conversation cannot stand apart from itself.
 */
export function StandAloneAction({
  item,
  className = "",
}: {
  item: WorkItemRow;
  className?: string;
}) {
  const profile = useProfile().data;
  const { busy, set } = useStandAlone(item);

  const owned = ownsWorkItem(profile, item);
  const lift = canStandAlone(item);
  const back = canGoBackToChat(item);
  if (!owned || (!lift && !back)) return null;

  return (
    <button
      type="button"
      disabled={busy}
      data-testid="stand-alone-action"
      onClick={(event) => {
        event.stopPropagation();
        void set(lift);
      }}
      className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50 ${className}`}
    >
      {lift ? STAND_ALONE_LABEL : PUT_BACK_LABEL}
    </button>
  );
}
