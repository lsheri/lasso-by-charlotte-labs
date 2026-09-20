import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { getWorkboardCardPreviewsFn } from "@/lib/canvas-lab.functions";
import type { WorkboardCardPreview } from "@/lib/workboard-card-preview.shared";

type PreviewMap = Record<string, WorkboardCardPreview>;

/** Session cache: newly visible chats are coalesced into one authenticated batch. */
export function useWorkboardCardPreviews(
  engagementId: string,
  profileId: string | undefined,
  enabled: boolean,
  visibleIds: readonly string[],
): PreviewMap {
  const fetchPreviews = useServerFn(getWorkboardCardPreviewsFn);
  const cacheRef = useRef<PreviewMap>({});
  const pendingRef = useRef(new Set<string>());
  const [cache, setCache] = useState<PreviewMap>({});
  const idsKey = [...visibleIds].sort().join(":");

  useEffect(() => {
    if (!enabled || !profileId) return;
    for (const id of visibleIds) if (!cacheRef.current[id]) pendingRef.current.add(id);
    if (pendingRef.current.size === 0) return;
    const timer = window.setTimeout(() => {
      const workItemIds = [...pendingRef.current];
      pendingRef.current.clear();
      void fetchPreviews({ data: { engagement_id: engagementId, work_item_ids: workItemIds, profile_id: profileId } })
        .then((rows) => {
          const next = { ...cacheRef.current };
          for (const row of rows as WorkboardCardPreview[]) next[row.workItemId] = row;
          cacheRef.current = next;
          setCache(next);
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, engagementId, fetchPreviews, idsKey, profileId, visibleIds]);

  return cache;
}