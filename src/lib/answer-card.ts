/**
 * Keeping an answer as a card.
 *
 * The card holds the answer text and nothing else as prose. What the answer
 * drew on is kept as stored references to turns, never as a copied quote, a
 * source name or a link. The person who asked is the author of the record.
 */

import type { WorkboardNodeInput } from "@/lib/canvas-lab-shared";

/** One read the answer made, as the answer surface already has it. */
export type AnswerRead = { id: string; depth: string };

/** One turn of a conversation the answer read. */
export type AnswerTurn = { id: string; work_item_id: string | null; turn_no: number | null };

export type AnswerCiteRow = { node_id: string; turn_id: string; ord: number };

/** The label on the action, kept in one place so the check never restates it. */
export const KEEP_ANSWER_LABEL = "Keep as a card";

/** An answer card is wider than a work card so the text has somewhere to sit. */
export const ANSWER_CARD_SIZE = { width: 320, height: 240 } as const;

/** The card face never carries a source name, so it carries a plain title. */
export const ANSWER_CARD_TITLE = "Answer";

/**
 * The conversations the answer actually read, in the order it read them.
 * A catalogue glance is a listing, not a reading, so it cites nothing.
 */
export function answerReadWorkItemIds(reads: readonly AnswerRead[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const read of reads) {
    if (read.depth === "catalogue" || read.depth === "unreadable") continue;
    if (seen.has(read.id)) continue;
    seen.add(read.id);
    ids.push(read.id);
  }
  return ids;
}

/** Turn ids in the order the answer used them: by conversation, then by turn. */
export function orderedAnswerTurnIds(
  workItemIds: readonly string[],
  turns: readonly AnswerTurn[],
): string[] {
  const ids: string[] = [];
  for (const workItemId of workItemIds) {
    const mine = turns
      .filter((turn) => turn.work_item_id === workItemId)
      .sort((a, b) => (a.turn_no ?? 0) - (b.turn_no ?? 0));
    for (const turn of mine) if (!ids.includes(turn.id)) ids.push(turn.id);
  }
  return ids;
}

/** Stored references only: a node, a turn, and the place it came in the answer. */
export function answerCiteRows(nodeId: string, turnIds: readonly string[]): AnswerCiteRow[] {
  return turnIds.map((turnId, index) => ({ node_id: nodeId, turn_id: turnId, ord: index }));
}

/**
 * The card the board saves. Never a work item and never a decision: the record
 * refuses an answer that claims to be either.
 */
export function answerNodeInput(args: {
  clientKey: string;
  at: { x: number; y: number };
  text: string;
}): WorkboardNodeInput {
  return {
    clientKey: args.clientKey,
    frameKey: null,
    kind: "answer",
    title: ANSWER_CARD_TITLE,
    body: args.text,
    x: args.at.x,
    y: args.at.y,
    w: ANSWER_CARD_SIZE.width,
    h: ANSWER_CARD_SIZE.height,
  };
}

/** The date on the card face, read from the saved row and never restated. */
export function answerAsOf(createdAt: string | null | undefined): string {
  if (!createdAt) return "";
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Keeping an answer is arranging the board, so only an editor may do it. */
export function canKeepAnswer(state: { onBoard: boolean; finished: boolean; canEdit: boolean }): boolean {
  return state.onBoard && state.finished && state.canEdit;
}
