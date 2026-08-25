/**
 * Pass 106: the display language of the provenance audit. Nothing here reads
 * the record differently, it only says what the record already holds in words
 * a person can read: a stable number per question, a plain status phrase, and
 * honest turn labels.
 */

import type { SpanStatus } from "@/lib/span-provenance-shared";

/**
 * Every question on an anchor gets a number by when it was asked, oldest first.
 * The rail is newest first, so numbering must never follow rail order: the
 * number is the identity of the question, not its position in a list.
 */
export function stitchNumbers<T extends { id: string; created_at: string }>(
  stitches: T[],
): Record<string, number> {
  const numbers: Record<string, number> = {};
  [...stitches]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .forEach((stitch, i) => {
      numbers[stitch.id] = i + 1;
    });
  return numbers;
}

/** What the status means, said the way a person would say it out loud. */
export function spanStatusPhrase(status: SpanStatus): string {
  if (status === "exact") return "Word for word";
  if (status === "paraphrase") return "Found, reworded";
  return "Not found in this record";
}

/** The action label: where the answer actually lives. */
export function showMeLabel(stitch: { to_turn_no: number | null }): string {
  return stitch.to_turn_no
    ? `Show me in the chat (turn ${stitch.to_turn_no})`
    : "Show me in the doc";
}

/** A turn's speaker, in app vocabulary. The assistant is always "AI". */
export function turnRoleLabel(role: string | null | undefined): string {
  return (role ?? "").toLowerCase() === "user" ? "You" : "AI";
}

/** The turn line in the left pane: the number stays, the vocabulary changes. */
export function turnLabel(turnNo: number, role: string | null | undefined): string {
  return `${turnNo} · ${turnRoleLabel(role)}`;
}

/** The one quiet line that explains the colours, always on, never a tooltip. */
export const LEGEND_LINE = "Green: word for word. Amber: reworded. Grey: not found in the record.";

export const RAIL_LABEL = "Where did this come from";
