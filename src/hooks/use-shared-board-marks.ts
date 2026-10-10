import { useMemo } from "react";

import { useProfile } from "@/hooks/use-profile";
import { useSharedWithMe } from "@/hooks/use-shared-with-me";

/**
 * Which boards were handed to the signed in person, and by whom.
 *
 * This hook owns its read: it calls the shared-by-person query itself rather
 * than peeking at whatever another component may have cached, so a mark never
 * depends on some other surface having mounted first. React Query deduplicates
 * by key, so a second caller of the same key adds no second round trip.
 *
 * A group with no usable granter name contributes nothing: no placeholder, no
 * "someone", no fallback to the board.
 */
export function useSharedBoardMarks(): Map<string, string> {
  const { profiles } = useProfile();
  const { groups } = useSharedWithMe(profiles);

  return useMemo(() => {
    const marks = new Map<string, string>();
    for (const group of groups) {
      if (!group.granterName.trim()) continue;
      for (const engagement of group.engagements) {
        if (!marks.has(engagement.id)) marks.set(engagement.id, group.granterName);
      }
    }
    return marks;
  }, [groups]);
}
