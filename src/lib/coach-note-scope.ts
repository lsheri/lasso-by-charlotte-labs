/**
 * PASS D — what a coaching note points at.
 *
 * Everything here is pure. A note's words never reach a dimension: only which
 * of the three scopes it was pinned to.
 */

export const NOTE_SCOPES = ["engagement", "task", "work_item"] as const;
export type NoteScope = (typeof NOTE_SCOPES)[number];

export type ScopedNote = {
  task_id?: string | null;
  work_item_id?: string | null;
};

/** A note points at the smallest thing it names. */
export function scopeOf(note: ScopedNote): NoteScope {
  if (note.work_item_id) return "work_item";
  if (note.task_id) return "task";
  return "engagement";
}

export type ScopeVocab = { engagement: string; workstream: string };

export function scopeLabel(scope: NoteScope, vocab: ScopeVocab): string {
  if (scope === "engagement") return vocab.engagement;
  if (scope === "task") return vocab.workstream;
  return "Piece of work";
}

/**
 * Chip order. A firm workspace leads with the engagement it is already in.
 * Everywhere else the piece of work is the thing people point at first, and a
 * workspace with no workstreams never offers the middle chip at all.
 */
export function scopeChoices(
  orgType: string | null | undefined,
  hasTasks: boolean,
): NoteScope[] {
  const workFirst = orgType !== "company";
  const order: NoteScope[] = workFirst
    ? ["work_item", "engagement", "task"]
    : ["engagement", "task", "work_item"];
  return order.filter((scope) => scope !== "task" || (hasTasks && orgType === "company"));
}

/** The first clause of a note, for a one line row. Never the whole note. */
export function firstLine(text: string, max = 96): string {
  const line = (text ?? "").split("\n").map((part) => part.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function firstName(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (!name) return "your coach";
  return name.split(/\s+/)[0] as string;
}

/** "1 new note from Priya" · "3 new notes from Priya". Never a badge count. */
export function newNoteLine(count: number, coach: string | null | undefined): string {
  const n = Math.max(1, Math.floor(count));
  return `${n} new note${n === 1 ? "" : "s"} from ${firstName(coach)}`;
}
