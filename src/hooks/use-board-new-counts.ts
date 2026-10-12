import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * F3 (MN-6): cards someone else put on each board since the viewer last opened
 * it. One shared query for the whole shell; rows read it from the cache.
 * Counts are about cards, never people.
 */
export const BOARD_NEW_COUNTS_KEY = ["board-new-counts"] as const;

type Row = { engagement_id: string; new_count: number };

export async function fetchBoardNewCounts(): Promise<Map<string, number>> {
  const rpc = supabase.rpc as unknown as (fn: string) => Promise<{ data: Row[] | null; error: unknown }>;
  const { data, error } = await rpc.call(supabase, "board_new_counts");
  if (error) throw error;
  const map = new Map<string, number>();
  for (const r of data ?? []) if (r.new_count > 0) map.set(r.engagement_id, r.new_count);
  return map;
}

export function useBoardNewCounts() {
  return useQuery({
    queryKey: BOARD_NEW_COUNTS_KEY,
    queryFn: fetchBoardNewCounts,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useBoardNewCount(engagementId: string): number {
  const data = useBoardNewCounts().data;
  return data instanceof Map ? (data.get(engagementId) ?? 0) : 0;
}

export function newCountLabel(count: number): string | null {
  if (!count || count <= 0) return null;
  return count > 9 ? "9+ NEW" : `${count} NEW`;
}
