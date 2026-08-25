import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
import { listShippedWork, shipWork, unshipWork } from "@/lib/shipped-work.functions";
import type { ShippedCard } from "@/lib/shipped-work-shared";
import { invalidateAfterWorkChange } from "@/lib/work-invalidation";

export const SHIPPED_WORK_KEY = ["shipped-work"] as const;

/** Coaches are outside the archive by policy; the query never runs for them. */
export function useShippedWork() {
  const { data: profile } = useProfile();
  const list = useServerFn(listShippedWork) as unknown as () => Promise<ShippedCard[]>;
  return useQuery({
    queryKey: [...SHIPPED_WORK_KEY],
    enabled: Boolean(profile) && profile?.role !== "coach",
    queryFn: () => list(),
  });
}

export function useShipWork() {
  const queryClient = useQueryClient();
  const run = useServerFn(shipWork);
  return useMutation({
    mutationFn: (input: { workItemId: string; engagementId: string | null }) =>
      run({ data: { work_item_id: input.workItemId, engagement_id: input.engagementId } }),
    onSuccess: async (_result, input) => {
      await invalidateAfterWorkChange(queryClient, input.workItemId);
    },
  });
}

export function useUnshipWork() {
  const queryClient = useQueryClient();
  const run = useServerFn(unshipWork);
  return useMutation({
    mutationFn: (input: { workItemId: string }) =>
      run({ data: { work_item_id: input.workItemId } }),
    onSuccess: async (_result, input) => {
      await invalidateAfterWorkChange(queryClient, input.workItemId);
    },
  });
}
