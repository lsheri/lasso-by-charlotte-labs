/**
 * The Kestrel Bay demo story: the server's answer to "may this person see it, and which window do they play?".
 * No flag sits in front of the launcher; this is the real check. It reads one profile row and one org id,
 * writes nothing, and answers `allowed: false` for every other workspace without saying why.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { resolveProfile } from "@/lib/profile-resolve";

import type { StoryRecording } from "./firm-story-recordings.server";
import { KESTREL_BAY_ORG_ID, storyAccess, type StoryAccess } from "./firm-story-shared";

type Db = SupabaseClient<Database>;

export async function firmStoryAccessCall(context: { supabase: Db; userId: string }, data: { profile_id?: string | null | undefined }): Promise<StoryAccess> {
  // The caller's own profile in the demo firm's workspace, or none: a person from any other workspace stops here.
  const profile = await resolveProfile(context.supabase, context.userId, data.profile_id, KESTREL_BAY_ORG_ID);
  if (!profile) return { allowed: false };
  const { data: row, error } = await context.supabase.from("profiles").select("is_guest, deactivated_at").eq("id", profile.id).maybeSingle();
  if (error || !row) return { allowed: false };
  return storyAccess({ orgId: profile.org_id, role: profile.role, isGuest: row.is_guest === true, deactivated: row.deactivated_at !== null });
}

/**
 * A recorded answer for one beat, or null. The same check as above runs first, and the recording is given only in the
 * window that plays the beat, so the Engagement lead's login is never handed the Partner's answer. Reads only.
 */
export async function firmStoryRecordingCall(
  context: { supabase: Db; userId: string },
  data: { profile_id?: string | null | undefined; beat: number },
): Promise<StoryRecording | null> {
  const access = await firmStoryAccessCall(context, data);
  if (!access.allowed) return null;
  const { recordingFor } = await import("./firm-story-recordings.server");
  return recordingFor(data.beat, access.window);
}
