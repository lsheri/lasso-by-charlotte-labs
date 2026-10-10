import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";

import { useProfile } from "@/hooks/use-profile";
import type { SharedGroup } from "@/lib/shared-with-me";

const EMPTY_GROUPS: SharedGroup[] = [];

/** Observe the shared-by-person query without starting another read. */
export function useSharedBoardMarks(): Map<string, string> {
  const { profiles } = useProfile();
  const csv = profiles.map((profile) => profile.id).join(",");
  const queryClient = useQueryClient();
  const groups = useSyncExternalStore(
    (onStoreChange) => queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === "shared-with-me" && event.query.queryKey[1] === csv) {
        onStoreChange();
      }
    }),
    () => queryClient.getQueryData<SharedGroup[]>(["shared-with-me", csv]) ?? EMPTY_GROUPS,
    () => EMPTY_GROUPS,
  );

  return useMemo(() => {
    const marks = new Map<string, string>();
    for (const group of groups ?? []) {
      if (!group.granterName.trim()) continue;
      for (const engagement of group.engagements) {
        if (!marks.has(engagement.id)) marks.set(engagement.id, group.granterName);
      }
    }
    return marks;
  }, [groups]);
}