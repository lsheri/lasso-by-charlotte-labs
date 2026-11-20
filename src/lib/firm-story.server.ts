/**
 * The Kestrel Bay demo story: the server's answer to "may this person see it, and which window do they play?".
 * No flag sits in front of the launcher; this is the real check. It reads one profile row, its workspace's marker and the story board's id,
 * writes nothing, and answers `allowed: false` for every other workspace without saying why.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { resolveProfile } from "@/lib/profile-resolve";

import { isDemoFirmSettings, STORY_BOARD_TITLE, storyAccess, type StoryAccess } from "./firm-story-shared";

type Db = SupabaseClient<Database>;

export async function firmStoryAccessCall(context: { supabase: Db; userId: string }, data: { profile_id?: string | null | undefined }): Promise<StoryAccess> {
  // The caller's own active profile, then its workspace's marker: a person from any other workspace stops here.
  const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
  if (!profile) return { allowed: false };
  const [{ data: row, error }, { data: org, error: orgError }] = await Promise.all([
    context.supabase.from("profiles").select("is_guest, deactivated_at").eq("id", profile.id).maybeSingle(),
    context.supabase.from("orgs").select("settings").eq("id", profile.org_id).maybeSingle(),
  ]);
  if (error || !row || orgError || !org) return { allowed: false };
  const access = storyAccess({ inDemoFirm: isDemoFirmSettings(org.settings), role: profile.role, isGuest: row.is_guest === true, deactivated: row.deactivated_at !== null });
  if (!access.allowed) return access;
  // The story's board, read as this person, so the database's own rule for who may open a board decides.
  const { data: board } = await context.supabase
    .from("engagements")
    .select("id")
    .eq("org_id", profile.org_id)
    .eq("title", STORY_BOARD_TITLE)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  return { ...access, boardId: board?.id ?? null };
}
