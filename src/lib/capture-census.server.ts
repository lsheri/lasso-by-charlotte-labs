import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { captureContextDims, type CaptureContextInput } from "./capture-census";
import { recordEvent } from "./telemetry.server";

/**
 * Pass 155. One capture.context per newly captured conversation, emitted at
 * the same moment as thread.shape. Everything in dims is banded, counted, or
 * a machine-generated identifier; never on a re-push of the same item.
 */

type Actor = {
  orgId: string;
  userId: string | null | undefined;
  profileId?: string | null | undefined;
};

export async function noteCaptureContext(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  input: CaptureContextInput,
): Promise<void> {
  await recordEvent(supabase, {
    eventType: "capture.context",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims: captureContextDims(input),
  });
}
