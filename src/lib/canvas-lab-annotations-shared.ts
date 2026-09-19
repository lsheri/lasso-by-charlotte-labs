/**
 * Slice 2a unit 1: the client-safe contract for highlights on chat turns.
 *
 * A highlight is private to the person who made it until a comment is attached
 * to it, which is a later unit. Nothing here re-anchors a highlight: when the
 * turn it was taken from has changed, the stored excerpt is shown as it was and
 * no range is drawn in the text.
 */

export type AnnotationLengthBand = "le50" | "le200" | "le500";

/** The excerpt column is capped in the database; the server truncates to match. */
export const MAX_EXCERPT_LENGTH = 500;

export type HighlightDto = {
  id: string;
  workItemId: string;
  turnNo: number;
  charStart: number;
  charEnd: number;
  excerpt: string;
  turnHash: string | null;
  version: number;
  createdAt: string;
};

export type AnnotationMutationResult =
  | { status: "saved"; highlight: HighlightDto }
  | { status: "conflict" }
  | { status: "forbidden" }
  | { status: "validation_error"; message: string };

/** Bands, never a length. A character count is closer to content than to shape. */
export function lengthBand(length: number): AnnotationLengthBand {
  if (length <= 50) return "le50";
  if (length <= 200) return "le200";
  return "le500";
}

/** Whitespace and case are not content differences for anchoring purposes. */
export function normalizeAnnotationText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export async function annotationTextHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeAnnotationText(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function excerptFor(content: string, charStart: number, charEnd: number): string {
  return content.slice(charStart, charEnd).slice(0, MAX_EXCERPT_LENGTH);
}

/**
 * A range must be a real, forward span inside the turn, and it must contain
 * something a person could read back.
 */
export function validateHighlightRange(
  content: string,
  charStart: number,
  charEnd: number,
): string | null {
  if (!Number.isInteger(charStart) || !Number.isInteger(charEnd)) return "That selection could not be read.";
  if (charStart < 0 || charEnd <= charStart) return "Select some text first.";
  if (charEnd > content.length) return "That selection is outside this turn.";
  if (excerptFor(content, charStart, charEnd).trim().length === 0) return "Select some text first.";
  return null;
}

export type CharRange = { charStart: number; charEnd: number };

/** Overlapping or touching ranges read as one mark. */
export function mergeRanges(ranges: readonly CharRange[]): CharRange[] {
  const sorted = [...ranges].sort((a, b) => a.charStart - b.charStart);
  const merged: CharRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.charStart <= last.charEnd) {
      last.charEnd = Math.max(last.charEnd, range.charEnd);
    } else {
      merged.push({ charStart: range.charStart, charEnd: range.charEnd });
    }
  }
  return merged;
}

/** The turn moved on since this was taken. Say so; never guess a new place. */
export function isStaleHighlight(turnHash: string | null, contentHash: string | null | undefined): boolean {
  if (!turnHash || !contentHash) return false;
  return turnHash !== contentHash;
}
