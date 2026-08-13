import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { hmacHex } from "./telemetry-v2.server";

/**
 * EXPERIMENT PLUMBING. Infrastructure only: no experiment is defined and no
 * surface reads a variant today.
 *
 * NEVER randomize what a manager can see, and never randomize how privacy is
 * explained. Visibility and the privacy explanation are promises to the person
 * doing the work, not variables to be tested on them. Experiments here are for
 * wording of prompts, ordering of suggestions, and similar product surfaces.
 */

export type Assignment = { experiment: string; variant: string };

/** Deterministic: the same person and experiment always land in the same arm. */
async function pickVariant(
  experimentName: string,
  profileId: string,
  variants: string[],
): Promise<string> {
  const key = process.env["TELEMETRY_SALT"] ?? "unsalted";
  const digest = await hmacHex(key, `exp:${experimentName}:${profileId}`);
  const bucket = parseInt(digest.slice(0, 8), 16) % variants.length;
  return variants[bucket] as string;
}

/**
 * Returns the arm for this person, writing the assignment once. The caller
 * passes the result to recordEventV2 as `exposure` on the next relevant event.
 * Returns null when the experiment is not running, so callers get the default.
 */
export async function assignVariant(
  supabase: SupabaseClient<Database>,
  experimentName: string,
  profileId: string,
): Promise<Assignment | null> {
  try {
    const { data: experiment } = await supabase
      .from("experiments")
      .select("id, name, variants, started_at, ended_at")
      .eq("name", experimentName)
      .maybeSingle();
    if (!experiment || !experiment.started_at || experiment.ended_at) return null;
    const variants = (experiment.variants ?? []) as string[];
    if (variants.length === 0) return null;

    const { data: existing } = await supabase
      .from("experiment_assignments")
      .select("variant")
      .eq("experiment_id", experiment.id)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (existing?.variant) return { experiment: experiment.name, variant: existing.variant };

    const variant = await pickVariant(experimentName, profileId, variants);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("experiment_assignments")
      .insert({ experiment_id: experiment.id, profile_id: profileId, variant });
    if (error) console.error("[experiments] assignment failed:", error.message);
    return { experiment: experiment.name, variant };
  } catch (e) {
    console.error("[experiments] assignVariant threw:", (e as Error).message);
    return null;
  }
}
