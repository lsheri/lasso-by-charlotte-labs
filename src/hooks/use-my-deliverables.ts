import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
import { listMyDeliverables } from "@/lib/overview-work.functions";
import type { DeliverableCardRow } from "@/lib/overview-work-shared";

export const MY_DELIVERABLES_KEY = ["my-deliverables"] as const;

/** A coach has no deliverables of their own, so the query never runs for them. */
export function useMyDeliverables() {
  const { data: profile } = useProfile();
  const list = useServerFn(listMyDeliverables) as unknown as () => Promise<DeliverableCardRow[]>;
  return useQuery({
    queryKey: [...MY_DELIVERABLES_KEY, profile?.id ?? null],
    enabled: Boolean(profile) && profile?.role !== "coach",
    queryFn: () => list(),
  });
}
