/**
 * S2: who is on this board, and the one call that changes it.
 *
 * Every rule about who may give what lives in set_engagement_person_access.
 * Nothing here writes to engagement_members, because no policy would allow it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  accessFromMemberRole,
  isConversationAccess,
  type ConversationAccess,
  type EngagementAccessChoice,
  type EngagementAccessValue,
  type EngagementPeoplePayload,
  type EngagementPerson,
} from "@/lib/engagement-access-shared";
import type { ResolvedProfile } from "@/lib/profile-resolve";

type Db = SupabaseClient<Database>;

/** Everyone in the workspace, carrying what they have on this board today. */
export async function listEngagementPeople(
  db: Db,
  engagementId: string,
  profile: ResolvedProfile,
): Promise<EngagementPeoplePayload> {
  const { isEngagementEditor } = await import("@/lib/canvas-lab.server");
  const canShare = await isEngagementEditor(db, engagementId, profile.id);
  if (!canShare) return { people: [], canShare: false };

  const [peopleRes, memberRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, display_name, deactivated_at, user_id")
      .eq("org_id", profile.org_id)
      .order("display_name", { ascending: true }),
    db.from("engagement_members").select("profile_id, member_role, conversation_access, added_at").eq("engagement_id", engagementId),
  ]);

  const roles = new Map<string, string>();
  const conversations = new Map<string, ConversationAccess>();
  const addedAt = new Map<string, string | null>();
  for (const row of memberRes.data ?? []) {
    roles.set(row.profile_id, row.member_role);
    addedAt.set(row.profile_id, row.added_at ?? null);
    if (isConversationAccess(row.conversation_access)) conversations.set(row.profile_id, row.conversation_access);
  }

  const emails = await workspaceEmails((peopleRes.data ?? []).map((row) => row.user_id));

  const people: EngagementPerson[] = (peopleRes.data ?? [])
    .filter((row) => !row.deactivated_at)
    .map((row) => ({
      id: row.id,
      display_name: row.display_name ?? "",
      access: accessFromMemberRole(roles.get(row.id) ?? null),
      isYou: row.id === profile.id,
      conversations: conversations.get(row.id) ?? "summaries",
      email: row.user_id ? (emails.get(row.user_id) ?? null) : null,
      addedAt: addedAt.get(row.id) ?? null,
    }));

  return { people, canShare: true };
}

/**
 * SHARE-2: addresses for people in the caller's own workspace, read only after
 * the caller is confirmed as an editor of this board. A failure leaves names.
 */
async function workspaceEmails(userIds: (string | null)[]): Promise<Map<string, string>> {
  const wanted = new Set(userIds.filter((id): id is string => Boolean(id)));
  const emails = new Map<string, string>();
  if (wanted.size === 0) return emails;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all(
      [...wanted].map(async (id) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        if (data?.user?.email) emails.set(id, data.user.email);
      }),
    );
  } catch {
    /* names still show without addresses */
  }
  return emails;
}

/** What this person has on this engagement right now, before anything changes. */
export async function currentAccess(
  db: Db,
  engagementId: string,
  personId: string,
): Promise<EngagementAccessChoice | null> {
  const { data } = await db
    .from("engagement_members")
    .select("member_role")
    .eq("engagement_id", engagementId)
    .eq("profile_id", personId)
    .maybeSingle();
  return accessFromMemberRole(data?.member_role ?? null);
}

export type AccessCallOutcome =
  | { status: "done"; returned: string; previous: EngagementAccessChoice | null }
  | { status: "refused" };

/** One call, straight through to the database function. */
export async function setPersonAccess(
  db: Db,
  engagementId: string,
  personId: string,
  access: EngagementAccessValue,
): Promise<AccessCallOutcome> {
  const previous = await currentAccess(db, engagementId, personId);
  const { data, error } = await db.rpc("set_engagement_person_access", {
    p_engagement: engagementId,
    p_profile: personId,
    p_access: access,
  });
  if (error || typeof data !== "string") return { status: "refused" };
  return { status: "done", returned: data, previous };
}

/** SH-3b: one call to the database function that owns every refusal. */
export async function setPersonConversations(
  db: Db,
  engagementId: string,
  personId: string,
  conversations: ConversationAccess,
): Promise<{ status: "done"; result: "changed" | "unchanged" } | { status: "refused" }> {
  const { data, error } = await db.rpc("set_member_conversation_access", {
    p_engagement: engagementId,
    p_profile: personId,
    p_access: conversations,
  });
  if (error || (data !== "changed" && data !== "unchanged")) return { status: "refused" };
  return { status: "done", result: data };
}

/** SH-3c-1: the member switch records the shared event only on a real change. */
export async function recordConversationsChange(
  db: Db,
  input: {
    answer: { status: "done"; result: "changed" | "unchanged" } | { status: "refused" };
    conversations: ConversationAccess;
    orgId: string;
    userId: string;
    profileId: string;
  },
): Promise<void> {
  if (input.answer.status !== "done" || input.answer.result !== "changed") return;
  const { recordEvent } = await import("@/lib/telemetry.server");
  await recordEvent(db, {
    eventType: "engagement.access_changed",
    orgId: input.orgId,
    userId: input.userId,
    profileId: input.profileId,
    dims: { conversations: input.conversations, result: "changed", target: "member" },
  });
}
