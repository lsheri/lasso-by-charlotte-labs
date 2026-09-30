import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { settingsChangedDims } from "./settings-events";

/**
 * S-T1: records settings.changed after a successful save. Never throws and
 * never blocks the save. An out-of-list value records nothing.
 */
export async function recordSettingsChanged(
  supabase: SupabaseClient<Database>,
  who: { orgId: string; userId: string; profileId: string | null },
  input: { section: string; setting: string; change: string; to_level?: string | undefined },
): Promise<void> {
  try {
    const dims = settingsChangedDims(input);
    if (!dims) return;
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "settings.changed",
      orgId: who.orgId,
      userId: who.userId,
      profileId: who.profileId,
      dims,
    });
  } catch {
    /* telemetry must never fail a save */
  }
}
