import { useQuery } from "@tanstack/react-query";

import type { LedList } from "@/lib/lead-view-shared";
import { listLedFn } from "@/lib/lead-view.functions";

/** How often the Lead's view reads again while a request waits. */
export const LED_WAITING_MS = 20_000;

/** The proposals this person leads (PR 4b). One cache entry, read by Home's Up next and by the chat pill. */
export function useLed(profileId: string | null | undefined, options: { refreshMs?: number } = {}) {
  return useQuery({
    queryKey: ["lead-view", profileId ?? null],
    enabled: Boolean(profileId),
    staleTime: 30_000,
    retry: false,
    // Phase 5: while a request waits for an admin, read again every 20 seconds (and on focus), so the answer lands
    // without a reload; otherwise only as asked.
    refetchInterval: (query) =>
      (query.state.data as LedList | undefined)?.proposals.some((row) => row.approval?.state === "waiting") ? LED_WAITING_MS : (options.refreshMs ?? false),
    queryFn: (): Promise<LedList> => listLedFn({ data: { profile_id: profileId as string } }),
  });
}
