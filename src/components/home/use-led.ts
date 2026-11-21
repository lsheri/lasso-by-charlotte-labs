import { useQuery } from "@tanstack/react-query";

import type { LedList } from "@/lib/lead-view-shared";
import { listLedFn } from "@/lib/lead-view.functions";

/** The proposals this person leads (PR 4b). One cache entry, read by Home's Up next and by the chat pill. */
export function useLed(profileId: string | null | undefined, options: { refreshMs?: number } = {}) {
  return useQuery({
    queryKey: ["lead-view", profileId ?? null],
    enabled: Boolean(profileId),
    staleTime: 30_000,
    retry: false,
    ...(options.refreshMs ? { refetchInterval: options.refreshMs } : {}),
    queryFn: (): Promise<LedList> => listLedFn({ data: { profile_id: profileId as string } }),
  });
}
