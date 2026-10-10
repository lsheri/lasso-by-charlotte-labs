import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useProfile } from "@/hooks/use-profile";
import type { SharedGroup } from "@/lib/shared-with-me";

/** Observe the shared-by-person query without starting another read. */
export function useSharedBoardMarks(): Map<string, string> {
  const { profiles } = useProfile();
  const csv = profiles.map((profile) => profile.id).join(",");
  const { data: groups } = useQuery<SharedGroup[]>({
    queryKey: ["shared-with-me", csv],
    enabled: false,
  });

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