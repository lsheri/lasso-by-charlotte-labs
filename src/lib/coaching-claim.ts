import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { claimedBand, type ClaimedBand } from "./coaching-access";

/**
 * PASS 171 — a coach accepting their invite picks up the links an admin set up
 * for them. The database routine carries every rule: it checks the invite, it
 * stamps only unclaimed and unended links, and it writes its own record. This
 * only calls it and describes the outcome.
 */

type Client = SupabaseClient<Database>;

export type ClaimOutcome = {
  count: number;
  band: ClaimedBand;
  /** One band per basis, so the covering event stays closed vocabulary. */
  byBasis: { basis: string; band: ClaimedBand }[];
};

export async function claimCoachingLinks(
  supabase: Client,
  code: string,
  profileId: string,
): Promise<ClaimOutcome> {
  const { data, error } = await supabase.rpc("claim_coaching_links", {
    p_code: code,
    p_actor_profile_id: profileId,
  });
  if (error) throw new Error(error.message);
  const count = typeof data === "number" ? data : 0;

  let byBasis: { basis: string; band: ClaimedBand }[] = [
    { basis: "subject_consent", band: claimedBand(0) },
  ];
  if (count > 0) {
    const { data: rows } = await supabase
      .from("coaching_links")
      .select("basis")
      .eq("coach_profile_id", profileId)
      .eq("invite_code", code);
    const tally = new Map<string, number>();
    for (const row of rows ?? []) tally.set(row.basis, (tally.get(row.basis) ?? 0) + 1);
    if (tally.size > 0) {
      byBasis = Array.from(tally.entries()).map(([basis, n]) => ({
        basis,
        band: claimedBand(n),
      }));
    } else {
      byBasis = [{ basis: "subject_consent", band: claimedBand(count) }];
    }
  }

  return { count, band: claimedBand(count), byBasis };
}
