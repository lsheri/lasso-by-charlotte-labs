/**
 * W2: lifting an artifact out of its conversation, and putting it back.
 *
 * Both directions are one stamp on work_items.ungrouped_at. No work item is
 * ever created here: the artifact already has its own row, and all that
 * changes is whether the app groups it with the conversation it came from.
 *
 * Every write runs on the caller-scoped client, so work_owner_all is what
 * decides who may do this. Only the person who pushed the work can reorganise
 * it; everyone else reads it and nothing more.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { WORKBOARD_CARD_DEFAULT_SIZE } from "@/lib/canvas-lab-shared";
import { ensureWorkItemNode, isEngagementEditor } from "@/lib/canvas-lab.server";
import { nearestFreeSlot, placementRectsForNodes } from "@/lib/workboard-placement";
import type { ResolvedProfile } from "@/lib/profile-resolve";
import {
  NOT_IN_A_CHAT_REFUSAL,
  TRANSCRIPT_REFUSAL,
  isTranscriptPiece,
} from "@/lib/work-standalone";

type Db = SupabaseClient<Database>;

export type StandAloneResult =
  | { status: "saved"; standsAlone: boolean; linkedOnBoard: boolean }
  | { status: "refused"; message: string }
  | { status: "forbidden" };

/**
 * The conversation's own card, if it is already on a board. Nothing is created
 * here on purpose: a board a person never put this conversation on stays empty.
 */
async function conversationNode(
  db: Db,
  origConversationId: string,
  ownerProfileId: string,
): Promise<
  | { boardId: string; nodeId: string; engagementId: string; at: { x: number; y: number; w: number; h: number } }
  | null
> {
  const { data: transcripts } = await db
    .from("work_items")
    .select("id")
    .eq("orig_conversation_id", origConversationId)
    .eq("type", "ai_thread")
    .eq("owner_id", ownerProfileId)
    .limit(5);
  const ids = (transcripts ?? []).map((row) => row.id);
  if (ids.length === 0) return null;

  const { data: nodes } = await db
    .from("workboard_nodes")
    .select("id, workboard_id, x, y, w, h")
    .in("work_item_id", ids)
    .is("deleted_at", null)
    .limit(1);
  const node = (nodes ?? [])[0];
  if (!node) return null;

  const { data: board } = await db
    .from("workboards")
    .select("id, engagement_id")
    .eq("id", node.workboard_id)
    .maybeSingle();
  if (!board) return null;
  return {
    boardId: board.id,
    nodeId: node.id,
    engagementId: board.engagement_id,
    at: {
      x: Number(node.x ?? 0),
      y: Number(node.y ?? 0),
      w: Number(node.w ?? WORKBOARD_CARD_DEFAULT_SIZE.width),
      h: Number(node.h ?? WORKBOARD_CARD_DEFAULT_SIZE.height),
    },
  };
}

/**
 * The sentence this whole unit exists for: this document came out of that
 * chat, on the record. Drawn only where the conversation already has a card.
 */
async function linkOnBoard(
  db: Db,
  profile: ResolvedProfile,
  origConversationId: string,
  workItemId: string,
): Promise<boolean> {
  const place = await conversationNode(db, origConversationId, profile.id);
  if (!place) return false;
  if (!(await isEngagementEditor(db, place.engagementId, profile.id))) return false;

  // Beside the conversation's own card, in free space. Without a point of its
  // own every lifted artifact would land on the board origin, stacked on the
  // one before it and nowhere near the chat it came out of.
  const { data: onBoard } = await db
    .from("workboard_nodes")
    .select("x, y, w, h, kind")
    .eq("workboard_id", place.boardId)
    .is("deleted_at", null);
  const taken = placementRectsForNodes(
    (onBoard ?? []).map((node) => ({
      x: Number(node.x ?? 0),
      y: Number(node.y ?? 0),
      width: Number(node.w ?? WORKBOARD_CARD_DEFAULT_SIZE.width),
      height: Number(node.h ?? WORKBOARD_CARD_DEFAULT_SIZE.height),
      kind: node.kind ?? undefined,
    })),
  );
  const at = nearestFreeSlot({ x: place.at.x + place.at.w + 40, y: place.at.y }, taken);

  const artifactNodeId = await ensureWorkItemNode(db, place.boardId, profile.id, workItemId, at);
  if (!artifactNodeId || artifactNodeId === place.nodeId) return false;

  const { error } = await db.from("workboard_links").insert({
    workboard_id: place.boardId,
    from_node_id: place.nodeId,
    to_node_id: artifactNodeId,
    from_anchor: "right",
    to_anchor: "left",
    relation: "produced",
    author_profile_id: profile.id,
    created_by: profile.id,
    updated_by: profile.id,
  });
  // 23505: the two cards are already connected, which is the state we wanted.
  if (error && error.code !== "23505") return false;
  return true;
}

export async function setWorkItemStandalone(
  db: Db,
  profile: ResolvedProfile,
  input: { workItemId: string; standAlone: boolean },
): Promise<StandAloneResult> {
  const { data: item } = await db
    .from("work_items")
    .select("id, type, owner_id, orig_conversation_id, source_meta, ungrouped_at")
    .eq("id", input.workItemId)
    .maybeSingle();
  if (!item) return { status: "forbidden" };
  if (item.owner_id !== profile.id) return { status: "forbidden" };
  if (!item.orig_conversation_id) return { status: "refused", message: NOT_IN_A_CHAT_REFUSAL };

  const piece = {
    type: item.type,
    source_meta: item.source_meta as { role?: "transcript" | "attachment" } | null,
  };
  if (input.standAlone && isTranscriptPiece(piece)) {
    return { status: "refused", message: TRANSCRIPT_REFUSAL };
  }

  const { error } = await db
    .from("work_items")
    .update({ ungrouped_at: input.standAlone ? new Date().toISOString() : null })
    .eq("id", item.id);
  if (error) return { status: "forbidden" };

  const linkedOnBoard = input.standAlone
    ? await linkOnBoard(db, profile, item.orig_conversation_id, item.id)
    : false;

  return { status: "saved", standsAlone: input.standAlone, linkedOnBoard };
}
