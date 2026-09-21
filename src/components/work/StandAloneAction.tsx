import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";
import { setWorkItemStandaloneFn } from "@/lib/work-standalone.functions";
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
  const queryClient = useQueryClient();
  const run = useServerFn(setWorkItemStandaloneFn);
  const [busy, setBusy] = useState(false);

  const owned = ownsWorkItem(profile, item);
  const lift = canStandAlone(item);
  const back = canGoBackToChat(item);
  if (!owned || (!lift && !back)) return null;

  async function act() {
    setBusy(true);
    try {
      const result = await run({
        data: {
          work_item_id: item.id,
          stand_alone: lift,
          ...(profile?.id ? { profile_id: profile.id } : {}),
        },
      });
      if (result.status === "refused") {
        toast.error(result.message);
        return;
      }
      if (result.status === "forbidden") {
        toast.error("That is not yours to reorganise.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      toast(
        result.standsAlone
          ? result.linkedOnBoard
            ? "It stands on its own, and it is joined to its chat on the board."
            : "It stands on its own. It still says which chat it came out of."
          : "It is back with its chat.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      data-testid="stand-alone-action"
      onClick={(event) => {
        event.stopPropagation();
        void act();
      }}
      className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50 ${className}`}
    >
      {lift ? STAND_ALONE_LABEL : PUT_BACK_LABEL}
    </button>
  );
}
