import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** One person, one day. High enough that real use never notices it. */
export const DAILY_ANALYSIS_CAP = 25;

/**
 * Analyses are the most expensive call Lasso makes, so they are the one thing
 * with a hard daily ceiling. Counted from analysis_runs, no new state.
 */
export async function assertUnderDailyCap(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("analysis_runs")
    .select("id", { count: "exact", head: true })
    .eq("run_by_profile_id", profileId)
    .gte("created_at", since);
  if (error) return;
  if ((count ?? 0) >= DAILY_ANALYSIS_CAP) {
    const { logHealth } = await import("./health.server");
    void logHealth({
      kind: "anomaly",
      surface: "analysis",
      ownerId: profileId,
      detail: "daily_analysis_cap_reached",
      meta: { cap: DAILY_ANALYSIS_CAP },
    });
    throw new Error(
      `You have run ${DAILY_ANALYSIS_CAP} analyses today, which is the daily limit. It resets in a few hours.`,
    );
  }
}
