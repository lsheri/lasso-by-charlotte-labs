import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mentionedProfileIds, parseMentions, type Mention } from "@/lib/mention-shared";
import { parseWorkboardStickyBody, type WorkboardCommand, type WorkboardMutationResult } from "@/lib/canvas-lab-shared";
import type { ResolvedProfile } from "@/lib/profile-resolve";

type Db = SupabaseClient<Database>;

export function newMentionIds(previous: readonly Mention[], current: readonly Mention[]): string[] {
  const saved = new Set(mentionedProfileIds(previous));
  return mentionedProfileIds(current).filter((id) => !saved.has(id));
}

/** Called only after a successful save, with the previous version read on the server. */
export async function notifySavedMentions(
  db: Db,
  profile: ResolvedProfile | null,
  engagementId: string,
  subjectType: "workboard_node" | "workboard_annotation",
  subjectId: string,
  previous: readonly Mention[],
  current: readonly Mention[],
): Promise<void> {
  try {
    if (!profile || !engagementId || !subjectId) return;
    const added = newMentionIds(previous, current);
    if (!added.length) return;
    const editor = await db.rpc("is_engagement_editor", { eng: engagementId });
    if (editor.error || editor.data !== true) return;
    const people = await db.rpc("board_people", { p_engagement: engagementId });
    if (people.error || !Array.isArray(people.data)) return;
    const members = new Set(people.data.map((person) => person.profile_id));
    const recipients = added.filter((id) => id !== profile.id && members.has(id));
    if (!recipients.length) return;
    const [author, board] = await Promise.all([
      db.from("profiles").select("display_name, user_id").eq("id", profile.id).is("deactivated_at", null).maybeSingle(),
      db.from("engagements").select("title, org_id").eq("id", engagementId).maybeSingle(),
    ]);
    if (author.error || board.error || !author.data?.user_id || !author.data.display_name?.trim() || !board.data?.title?.trim() || !board.data.org_id) return;
    // Authorization and recipient membership were checked through the caller's client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const recipient of recipients) {
      try {
        await supabaseAdmin.rpc("notify", {
          p_recipient: recipient,
          p_org: board.data.org_id,
          p_kind: "mention_received",
          p_section: "needs_you",
          p_subject_type: subjectType,
          p_subject_id: subjectId,
          p_group_key: `mention:${subjectType}:${subjectId}:${recipient}`,
          p_payload: { by: author.data.display_name, board: board.data.title },
        });
      } catch {
        // One unavailable recipient must not prevent the others or undo the save.
      }
    }
    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(db, {
      eventType: "workboard.mention_created",
      orgId: board.data.org_id,
      userId: author.data.user_id,
      profileId: profile.id,
      dims: {
        surface: subjectType === "workboard_node" ? "sticky" : "comment",
        count_band: recipients.length === 1 ? "1" : recipients.length <= 4 ? "2_4" : "5_plus",
      },
    });
  } catch {
    // Notifications and their event are best effort. The person's work already landed.
  }
}

type StickyBefore = { nodeId?: string; clientKey?: string; previous: Mention[]; current: Mention[] };

/** Read before save, including first-save materialization and idempotent creates. */
export async function captureStickyMentions(db: Db, engagementId: string, command: WorkboardCommand): Promise<StickyBefore[]> {
  const candidates = command.type === "node_update" && command.patch.body !== undefined
    ? [{ nodeId: command.nodeId, body: command.patch.body }]
    : command.type === "node_create" && command.node.kind === "sticky"
      ? [{ clientKey: command.node.clientKey, body: command.node.body ?? "" }]
      : command.type === "materialize"
        ? command.nodes.filter((node) => node.kind === "sticky").map((node) => ({ clientKey: node.clientKey, body: node.body ?? "" }))
        : [];
  if (!candidates.length) return [];
  const board = await db.from("workboards").select("id").eq("engagement_id", engagementId).maybeSingle();
  if (board.error) return [];
  const before: StickyBefore[] = [];
  for (const candidate of candidates) {
    const current = parseWorkboardStickyBody(candidate.body);
    if (!current) continue;
    let previous: Mention[] = [];
    if (board.data) {
      let query = db.from("workboard_nodes").select("id, kind, body").eq("workboard_id", board.data.id);
      query = "nodeId" in candidate ? query.eq("id", candidate.nodeId) : query.eq("client_key", candidate.clientKey);
      const row = await query.maybeSingle();
      if (row.error || ("nodeId" in candidate && !row.data)) continue;
      if (row.data && row.data.kind !== "sticky") continue;
      previous = parseMentions(parseWorkboardStickyBody(row.data?.body)?.mentions);
    } else if ("nodeId" in candidate) continue;
    before.push({ ...candidate, previous, current: parseMentions(current.mentions) });
  }
  return before;
}

export async function notifySavedStickies(db: Db, profile: ResolvedProfile, engagementId: string, before: StickyBefore[], result: WorkboardMutationResult): Promise<void> {
  if (result.status !== "saved") return;
  for (const sticky of before) {
    const id = sticky.nodeId ?? (sticky.clientKey ? result.created?.nodes?.[sticky.clientKey] ?? result.created?.nodeId : undefined);
    if (id) await notifySavedMentions(db, profile, engagementId, "workboard_node", id, sticky.previous, sticky.current);
  }
}

export async function notifySavedComment(db: Db, profile: ResolvedProfile, boardId: string, id: string, previous: readonly Mention[], current: readonly Mention[]): Promise<void> {
  try {
    const board = await db.from("workboards").select("engagement_id").eq("id", boardId).maybeSingle();
    if (board.error || !board.data?.engagement_id) return;
    await notifySavedMentions(db, profile, board.data.engagement_id, "workboard_annotation", id, previous, current);
  } catch {
    // A notification failure never fails a comment save.
  }
}