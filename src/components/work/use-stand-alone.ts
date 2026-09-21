import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";
import { setWorkItemStandaloneFn } from "@/lib/work-standalone.functions";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * W2: the one write behind both directions, so the card and the menu behave
 * the same. A refusal from the server is shown in its own words.
 */
export function useStandAlone(item: Pick<WorkItemRow, "id">): {
  busy: boolean;
  set: (standAlone: boolean) => Promise<void>;
} {
  const profile = useProfile().data;
  const queryClient = useQueryClient();
  const run = useServerFn(setWorkItemStandaloneFn);
  const [busy, setBusy] = useState(false);

  async function set(standAlone: boolean) {
    setBusy(true);
    try {
      const result = await run({
        data: {
          work_item_id: item.id,
          stand_alone: standAlone,
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

  return { busy, set };
}
