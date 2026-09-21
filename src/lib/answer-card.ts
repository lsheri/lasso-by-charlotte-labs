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
export const KEEP_ANSWER_LABEL = "Keep as a card";

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
