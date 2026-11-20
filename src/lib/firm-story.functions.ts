import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StoryAccess } from "@/lib/firm-story-shared";

type AccessInput = { profile_id?: string | null | undefined };

function validate(input: AccessInput): AccessInput {
  const profileId = typeof input?.profile_id === "string" && input.profile_id.trim() ? input.profile_id.trim() : null;
  return { profile_id: profileId };
}

/**
 * 19 Nov, Kestrel Bay demo story: whether the signed-in person may see the guided story, and which window they play.
 * Only members of the demo firm's workspace are allowed; the check is in firm-story.server.ts. Reads only.
 */
export const firmStoryAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<StoryAccess> => (await import("./firm-story.server")).firmStoryAccessCall(context, data));

type RecordingInput = AccessInput & { beat: number };

function validateRecording(input: RecordingInput): RecordingInput {
  const beat = typeof input?.beat === "number" && Number.isInteger(input.beat) && input.beat >= 0 && input.beat <= 8 ? input.beat : -1;
  return { ...validate(input), beat };
}

/**
 * 19 Nov, Kestrel Bay demo story, part 2: the recorded answer for a beat, for when the live answer fails or is slow.
 * Only an allowed person of the demo firm, in the window that plays the beat, gets one. Reads only, no model call.
 */
export const firmStoryRecordingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRecording)
  .handler(async ({ data, context }) => (await import("./firm-story.server")).firmStoryRecordingCall(context, data));
