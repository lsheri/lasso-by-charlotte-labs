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

/** A stored reference: which source, read how deeply, and where in the answer. */
export type AnswerCiteRow = {
  node_id: string;
  work_item_id: string;
  turn_id: string | null;
  depth: "full" | "extract";
  ord: number;
};

/** The label on the action, kept in one place so the check never restates it. */
export const KEEP_ANSWER_LABEL = "Put on board";

/** Read out after an answer lands on the board. */
export const KEEP_ANSWER_ANNOUNCEMENT = "Put on the board.";

/** The drag type an answer carries from the chat to the board. */
export const ANSWER_DRAG_MIME = "application/x-lasso-answer";

/** True only when a drag carries an answer from the chat. */
export function isAnswerDrag(types: readonly string[] | DOMStringList | null | undefined): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes(ANSWER_DRAG_MIME);
}

/** Read a dropped answer, or null when the payload is not one. */
export function parseAnswerDrop(raw: string): { messageId: number; text: string; reads: AnswerRead[] } | null {
  try {
    const value = JSON.parse(raw) as { messageId?: unknown; text?: unknown; reads?: unknown };
    if (typeof value.text !== "string" || !value.text.trim()) return null;
    const reads = Array.isArray(value.reads)
      ? value.reads.filter((r): r is AnswerRead => !!r && typeof r.id === "string" && typeof r.depth === "string")
      : [];
    return { messageId: Number(value.messageId), text: value.text, reads };
  } catch {
    return null;
  }
}

/** An answer card is wider than a work card so the text has somewhere to sit. */
export const ANSWER_CARD_SIZE = { width: 320, height: 240 } as const;

/** The card face never carries a source name, so it carries a plain title. */
export const ANSWER_CARD_TITLE = "Answer";

/**
 * The sources the answer actually read, in the order it read them, each with
 * the depth it was read at. A listing is not a reading, so it cites nothing,
 * and a source read twice is recorded once, at the first depth it was read.
 *
 * turn_id stays null. The answer knows which source it read, not which turn,
 * and the record will not claim a precision the answer never earned.
 */
export function answerCiteRows(nodeId: string, reads: readonly AnswerRead[]): AnswerCiteRow[] {
  const seen = new Set<string>();
  const rows: AnswerCiteRow[] = [];
  for (const read of reads) {
    if (read.depth !== "full" && read.depth !== "extract") continue;
    if (seen.has(read.id)) continue;
    seen.add(read.id);
    rows.push({ node_id: nodeId, work_item_id: read.id, turn_id: null, depth: read.depth, ord: rows.length });
  }
  return rows;
}


/**
 * The card the board saves. Never a work item and never a decision: the record
 * refuses an answer that claims to be either.
 */
export function answerNodeInput(args: {
  clientKey: string;
  at: { x: number; y: number };
  text: string;
  /** The workstream the card is kept into. Null keeps it freeform. */
  frameKey?: string | null;
}): WorkboardNodeInput {
  return {
    clientKey: args.clientKey,
    frameKey: args.frameKey ?? null,
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
