import { WORKBOARD_STICKY_FILLS, type WorkboardStickyFill } from "@/lib/canvas-lab-shared";
import { MAX_BODY_LENGTH, type AnnotationVisibility } from "@/lib/canvas-lab-annotations-shared";

/**
 * S2 (stickies on the work, 10 Nov): the client-safe contract for a sticky left on a spot in a piece of
 * work. A sticky belongs to the board it was left on (workboard_annotations.kind = 'sticky'). It sits on
 * an anchor (a slide or page, a chat turn, a doc section, a sheet row, a picture, or the piece as a whole)
 * at a position inside that anchor, 0 to 1 across and down.
 *
 * It describes the work, never the person: what is on it is a note and a next step. S4: it can ask one
 * person on the board to act, and that person (or the author) marks it done. Nothing counts per person.
 */

export type StickyAnchorKind = "page" | "turn" | "section" | "row" | "media" | "item";

export const STICKY_ANCHOR_KINDS: readonly StickyAnchorKind[] = [
  "page",
  "turn",
  "section",
  "row",
  "media",
  "item",
];

export type StickyAnchor =
  | { kind: "page"; pageNo: number }
  | { kind: "turn"; turnNo: number }
  | { kind: "section"; sectionKey: string }
  | { kind: "row"; rowKey: string }
  | { kind: "media" }
  | { kind: "item" };

export type StickyDto = {
  id: string;
  workItemId: string;
  anchor: StickyAnchor;
  posX: number;
  posY: number;
  fill: WorkboardStickyFill;
  body: string;
  visibility: AnnotationVisibility;
  /** The reader wrote it, so the reader can change, move or remove it. */
  isMine: boolean;
  authorName: string;
  /** S4: who the sticky asks to act, if anyone. Only a board-visible sticky can be assigned. */
  assigneeId: string | null;
  assigneeName: string | null;
  /** S4: the reader is the assignee, so the sticky asks something of them. */
  isAssignedToMe: boolean;
  /** S4: the assignee can mark it done or reopen it; so can its author. */
  canMarkDone: boolean;
  /** Done stickies stay where they are, marked done (S4). */
  doneAt: string | null;
  doneByName: string | null;
  /** A turn sticky whose turn has changed since. Shown, never moved. */
  stale: boolean;
  version: number;
  createdAt: string;
};

export type StickyMutationResult =
  | { status: "saved"; sticky: StickyDto }
  | { status: "conflict" }
  | { status: "forbidden" }
  | { status: "validation_error"; message: string };

export const STICKY_COPY = {
  empty: "Write something first.",
  tooLong: "That is longer than a sticky can be.",
  noSpot: "That spot could not be read.",
  noColour: "Pick one of the sticky colours.",
  notOnBoard: "Assign a sticky to someone on this board.",
  justMeUnassigned: "A just-me sticky stays with you. Show it to the board to assign it.",
} as const;

export function isStickyFill(value: unknown): value is WorkboardStickyFill {
  return typeof value === "string" && (WORKBOARD_STICKY_FILLS as readonly string[]).includes(value);
}

/** A position is a fraction of its anchor; anything else is clamped into it. */
export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function validateStickyBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return STICKY_COPY.empty;
  if (trimmed.length > MAX_BODY_LENGTH) return STICKY_COPY.tooLong;
  return null;
}

/** An anchor has to name its spot: a page number, a turn number, a section heading or a row. */
export function validateStickyAnchor(anchor: StickyAnchor | null | undefined): string | null {
  if (!anchor) return STICKY_COPY.noSpot;
  switch (anchor.kind) {
    case "page":
      return Number.isInteger(anchor.pageNo) && anchor.pageNo > 0 ? null : STICKY_COPY.noSpot;
    case "turn":
      return Number.isInteger(anchor.turnNo) && anchor.turnNo >= 0 ? null : STICKY_COPY.noSpot;
    case "section":
      return anchor.sectionKey.trim() ? null : STICKY_COPY.noSpot;
    case "row":
      return anchor.rowKey.trim() ? null : STICKY_COPY.noSpot;
    case "media":
    case "item":
      return null;
    default:
      return STICKY_COPY.noSpot;
  }
}

/** The columns an anchor writes, and nothing else. */
export function anchorColumns(anchor: StickyAnchor): {
  anchor_kind: StickyAnchorKind;
  page_no: number | null;
  turn_no: number | null;
  section_key: string | null;
  row_key: string | null;
} {
  return {
    anchor_kind: anchor.kind,
    page_no: anchor.kind === "page" ? anchor.pageNo : null,
    turn_no: anchor.kind === "turn" ? anchor.turnNo : null,
    section_key: anchor.kind === "section" ? anchor.sectionKey.trim().slice(0, 1000) : null,
    row_key: anchor.kind === "row" ? anchor.rowKey.trim().slice(0, 64) : null,
  };
}

/** The anchor a stored row describes. A row that names no readable spot reads as the whole piece. */
export function anchorFromRow(row: {
  anchor_kind: string | null;
  page_no: number | null;
  turn_no: number | null;
  section_key: string | null;
  row_key: string | null;
}): StickyAnchor {
  if (row.anchor_kind === "page" && row.page_no) return { kind: "page", pageNo: row.page_no };
  if (row.anchor_kind === "turn" && row.turn_no !== null)
    return { kind: "turn", turnNo: row.turn_no };
  if (row.anchor_kind === "section" && row.section_key)
    return { kind: "section", sectionKey: row.section_key };
  if (row.anchor_kind === "row" && row.row_key) return { kind: "row", rowKey: row.row_key };
  if (row.anchor_kind === "media") return { kind: "media" };
  return { kind: "item" };
}

/**
 * Where a sticky sits, in the words a person would use. A deck has slides; anything else with pages has
 * pages. Never names a person.
 */
export function stickyPlace(anchor: StickyAnchor, workKind?: string | null): string {
  switch (anchor.kind) {
    case "page":
      return `${workKind === "deck" ? "Slide" : "Page"} ${anchor.pageNo}`;
    case "turn":
      return `Turn ${anchor.turnNo}`;
    case "section":
      return anchor.sectionKey;
    case "row":
      return `Row ${anchor.rowKey}`;
    case "media":
      return "On the picture";
    default:
      return "On this piece";
  }
}
