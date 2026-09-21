/**
 * W2: an artifact that came out of a conversation can be lifted so it stands
 * on its own, and put back again. Both directions are one stamp on
 * work_items.ungrouped_at: null means it groups with its conversation, a time
 * means it stands alone. Nothing is lost either way.
 *
 * This module is the shared reading of that field. It holds no queries, so the
 * card, the menu and the server all answer the same questions the same way.
 */

import { attachmentKindNoun, vendorLabel } from "./conversation-shared";
import { workIdentity } from "./work-identity";
import type { WorkItemRow } from "./work-types";

type Piece = Pick<WorkItemRow, "type"> & {
  source_meta?: WorkItemRow["source_meta"];
  orig_conversation_id?: WorkItemRow["orig_conversation_id"];
  ungrouped_at?: WorkItemRow["ungrouped_at"];
  source_vendor?: WorkItemRow["source_vendor"];
};

/** Whether this row is currently standing on its own. */
export function standsOnItsOwn(item: Pick<Piece, "ungrouped_at">): boolean {
  return Boolean(item.ungrouped_at);
}

/**
 * The transcript is the conversation itself. It is the head of the group and
 * cannot be pulled out of the thing it is, so only an attachment can be
 * lifted.
 */
export function isTranscriptPiece(item: Piece): boolean {
  return item.source_meta?.role === "transcript" || item.type === "ai_thread";
}

/** Only an attachment that still belongs to a conversation can be lifted. */
export function canStandAlone(item: Piece): boolean {
  if (!item.orig_conversation_id) return false;
  if (standsOnItsOwn(item)) return false;
  return !isTranscriptPiece(item);
}

/** Only something that was lifted can be put back. */
export function canGoBackToChat(item: Piece): boolean {
  return Boolean(item.orig_conversation_id) && standsOnItsOwn(item);
}

export const STAND_ALONE_LABEL = "Let this stand on its own";
export const PUT_BACK_LABEL = "Put this back with the chat";

/** Said plainly, with no jargon, when someone asks for the impossible. */
export const TRANSCRIPT_REFUSAL =
  "A conversation cannot stand apart from itself. Only a document that came with it can.";

export const NOT_IN_A_CHAT_REFUSAL = "This did not come out of a chat, so it already stands on its own.";

/**
 * "Document that came out of a Claude chat." The vendor is in source_vendor
 * and the artifact's own kind is in source_meta.kind, so nothing new is stored
 * to say this.
 */
export function cameOutOfLine(
  item: Piece,
  options: { vendorVisible?: boolean } = {},
): string | null {
  if (!item.orig_conversation_id || isTranscriptPiece(item)) return null;
  // Read the fields. Parsing a display label would go quietly wrong the first
  // time somebody changes how that label is written.
  const kind = attachmentKindNoun(item.source_meta?.kind) ?? workIdentity(item as WorkItemRow).label;
  const vendor = options.vendorVisible === false ? "AI" : vendorLabel(item.source_vendor ?? item.source_meta?.vendor);
  return `${kind} that came out of a ${vendor} chat`;
}
