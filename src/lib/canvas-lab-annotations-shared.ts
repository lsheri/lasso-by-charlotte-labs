/**
 * Slice 2a unit 1: the client-safe contract for highlights on chat turns.
 *
 * A highlight is private to the person who made it until a comment is attached
 * to it, which is a later unit. Nothing here re-anchors a highlight: when the
 * turn it was taken from has changed, the stored excerpt is shown as it was and
 * no range is drawn in the text.
 */

export type AnnotationLengthBand = "le50" | "le200" | "le500" | "gt500";

/** The excerpt column is capped in the database; the server truncates to match. */
export const MAX_EXCERPT_LENGTH = 500;

/** A comment body is longer-form than an excerpt, and the column says so. */
export const MAX_BODY_LENGTH = 4000;

/** Who can read a highlight. New highlights are shared with the team. */
export type AnnotationVisibility = "just_me" | "engagement";

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
  /** The turn has changed since this was taken, so the range is not drawn. */
  stale: boolean;
  visibility: AnnotationVisibility;
  /** The reader made this one, so the reader can change or remove it. */
  isMine: boolean;
  authorName: string;
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
  if (length <= 500) return "le500";
  return "gt500";
}

/**
 * Slice 2a unit 2: a comment is review, so it is readable by everyone who can
 * already see the item. Only its author changes or removes it.
 */
export type CommentDto = {
  id: string;
  parentId: string | null;
  authorProfileId: string;
  authorName: string;
  isMine: boolean;
  body: string;
  excerpt: string;
  turnNo: number | null;
  charStart: number | null;
  charEnd: number | null;
  /** Top level only: the turn has changed, so the passage is not drawn. */
  stale: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
};

export type CommentThreadDto = CommentDto & { replies: CommentDto[] };

export type CommentMutationResult =
  | { status: "saved"; comment: CommentDto }
  | { status: "conflict" }
  | { status: "forbidden" }
  | { status: "validation_error"; message: string };

/** A body has to say something, and it has to fit the column. */
export function validateCommentBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "Write something first.";
  if (trimmed.length > MAX_BODY_LENGTH) return "That is longer than a comment can be.";
  return null;
}

/** An update within a few seconds of writing is the write itself, not an edit. */
export function isEdited(createdAt: string, updatedAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated > created + 5000;
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
