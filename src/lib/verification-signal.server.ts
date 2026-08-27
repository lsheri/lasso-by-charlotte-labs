import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * The "What to fact check" prompt mandates exactly three section labels, so the
 * rendered output can be counted without parsing anything else out of it. No
 * output text is ever stored: only the kind of each occurrence travels.
 */
const LABELS = [
  { label: "CHECKED IN THE CONVERSATION", kind: "checked_in_conversation", confirmed: true },
  { label: "CHECKED AGAINST A SOURCE", kind: "checked_against_source", confirmed: true },
  { label: "NOTHING VISIBLE", kind: "nothing_visible", confirmed: false },
] as const;

/** The prompt caps the analysis at eight claims, so the signal caps there too. */
const MAX_CLAIMS = 8;

function occurrences(text: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

export async function recordVerificationSignal(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    orgId: string;
    profileId: string;
    workItemId: string;
    outputText: string;
  },
): Promise<void> {
  try {
    const text = input.outputText.toUpperCase();
    const counted: { kind: string; confirmed: boolean }[] = [];
    for (const entry of LABELS) {
      const n = occurrences(text, entry.label);
      for (let i = 0; i < n; i += 1) counted.push({ kind: entry.kind, confirmed: entry.confirmed });
    }
    if (counted.length === 0) return;
    const claims = counted.slice(0, MAX_CLAIMS);

    const { data: link } = await supabase
      .from("episode_items")
      .select("episode_id")
      .eq("work_item_id", input.workItemId)
      .limit(1)
      .maybeSingle();
    const episodeId = link?.episode_id ?? null;

    const { recordEventV2 } = await import("./telemetry-v2.server");
    const { writeVerificationFact } = await import("./facts.server");
    for (const claim of claims) {
      await recordEventV2(supabase, input.userId, {
        eventName: "verification.detected",
        props: { kind: claim.kind },
        profileId: input.profileId,
        workItemId: input.workItemId,
        episodeId,
      });
      await writeVerificationFact(
        { supabase, orgId: input.orgId, profileId: input.profileId },
        { kind: claim.kind, confirmed: claim.confirmed, episodeId },
      );
    }
  } catch (e) {
    console.error("[verification] signal failed:", (e as Error).message);
  }
}
