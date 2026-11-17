import type { Json } from "@/integrations/supabase/types";

import type { DemoBoard, DemoItem, DemoVendor } from "./types";

/**
 * Turns one demo board into the rows the board page reads, with a designed layout: section frames in a row, items in
 * a three-column grid inside their section, workstream outlines in a second row for phased boards. Pure: ids come
 * from the caller, so tests can check the plan without a database.
 */

export const CARD_W = 260;
export const CARD_H = 220;
const GAP = 40;
const PAD = 40;
const HEADER = 80;
const COLS = 3;
export const FRAME_W = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP;
const FRAME_GAP = 120;
const STICKY_W = 200;
const STICKY_H = 140;
/**
 * A board with no workstreams shows the app's empty "Workstreams" box at a fixed spot (createLabFrames: x 526, y 420,
 * 430 by 520). Sections start below it there, so the two never overlap.
 */
export const NO_WORKSTREAM_TOP = 1080;

export function sectionTop(board: Pick<DemoBoard, "workstreams">): number {
  return board.workstreams?.length ? 0 : NO_WORKSTREAM_TOP;
}

/** A deck's slides as the card preview reads them (document_versions.slide_map): the first string is the title. */
export function slideMap(body: string): { slides: { title: string; lines: string[] }[] } {
  const slides: { title: string; lines: string[] }[] = [];
  for (const chunk of body.split(/^##\s+Slide\s+\d+\s*$/m).slice(1)) {
    const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length) slides.push({ title: lines[0]!, lines: lines.slice(1, 12) });
  }
  return { slides };
}

export type PlannedFrame = {
  id: string;
  key: string;
  kind: "custom" | "task";
  label: string;
  taskName: string | null;
  sequenceNo: number | null;
  ord: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PlannedCard = {
  nodeId: string;
  itemKey: string;
  /** Set only for workstream outlines, which file the card; sections are layout only. */
  frameId: string | null;
  x: number;
  y: number;
};

export type PlannedSticky = { nodeId: string; frameKey: string; text: string; fill: string; x: number; y: number };

export type PlannedLink = { fromItem: string; toItem: string; relation: "produced" | "informed" };

export type BoardPlan = {
  frames: PlannedFrame[];
  cards: PlannedCard[];
  stickies: PlannedSticky[];
  links: PlannedLink[];
};

/** The fidelities work_items accepts (work_items_content_fidelity_check). */
export const CONTENT_FIDELITIES = ["verbatim", "summary", "transcribed", "reference"] as const;

/** Where each item came from, in the vocabulary real captures use. */
export function sourceFor(vendor: DemoVendor, type: DemoItem["type"]): { source: string; sourceVendor: string | null; fidelity: string } {
  switch (vendor) {
    case "claude":
      return { source: "mcp:claude", sourceVendor: "claude", fidelity: type === "ai_thread" ? "transcribed" : "verbatim" };
    case "chatgpt":
      return { source: "mcp:chatgpt", sourceVendor: "chatgpt", fidelity: type === "ai_thread" ? "transcribed" : "verbatim" };
    case "granola":
      return { source: "connector:granola", sourceVendor: "granola", fidelity: "transcribed" };
    case "google_docs":
    case "google_slides":
      return { source: "connector:googledrive", sourceVendor: "gdrive", fidelity: "verbatim" };
    default:
      return { source: "upload", sourceVendor: null, fidelity: "verbatim" };
  }
}

/** A file name the text reader recognizes as markdown. */
export function fileNameFor(item: DemoItem): string {
  const safe = item.title.replace(/[^A-Za-z0-9 ._-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || item.key;
  return `${safe}.md`;
}

function gridIn(frame: { x: number; y: number }, index: number, w: number, h: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: frame.x + PAD + col * (CARD_W + GAP) + (CARD_W - w) / 2, y: frame.y + HEADER + row * (CARD_H + GAP) + (CARD_H - h) / 2 };
}

function rowsFor(count: number): number {
  return Math.max(2, Math.ceil(count / COLS));
}

export function planBoard(board: DemoBoard, newId: () => string, taskIdFor: (workstream: string) => string): BoardPlan {
  const placed = board.items.filter((item) => item.placed !== false);
  const stickies = board.stickies ?? [];
  const occupants = (label: string) => placed.filter((item) => item.section === label).length + stickies.filter((s) => s.section === label).length;

  const frames: PlannedFrame[] = [];
  const sectionHeight = Math.max(...board.sections.map((label) => HEADER + rowsFor(occupants(label)) * (CARD_H + GAP) + PAD - GAP));
  const top = sectionTop(board);
  board.sections.forEach((label, index) => {
    frames.push({
      id: newId(),
      key: `section:${newId()}`,
      kind: "custom",
      label,
      taskName: null,
      sequenceNo: index + 1,
      ord: index,
      x: index * (FRAME_W + FRAME_GAP),
      y: top,
      w: FRAME_W,
      h: sectionHeight,
    });
  });
  const workstreams = board.workstreams ?? [];
  if (workstreams.length) {
    const top = sectionHeight + FRAME_GAP * 2;
    const height = Math.max(...workstreams.map((label) => HEADER + rowsFor(occupants(label)) * (CARD_H + GAP) + PAD - GAP));
    workstreams.forEach((label, index) => {
      frames.push({
        id: newId(),
        key: `task:${taskIdFor(label)}`,
        kind: "task",
        label,
        taskName: label,
        sequenceNo: null,
        ord: board.sections.length + index,
        x: index * (FRAME_W + FRAME_GAP),
        y: top,
        w: FRAME_W,
        h: height,
      });
    });
  }

  const byLabel = new Map(frames.map((frame) => [frame.label, frame]));
  const filled = new Map<string, number>();
  const cards: PlannedCard[] = [];
  for (const item of placed) {
    const frame = byLabel.get(item.section)!;
    const index = filled.get(frame.label) ?? 0;
    filled.set(frame.label, index + 1);
    cards.push({ nodeId: newId(), itemKey: item.key, frameId: frame.kind === "task" ? frame.id : null, ...gridIn(frame, index, CARD_W, CARD_H) });
  }
  const plannedStickies: PlannedSticky[] = stickies.map((sticky) => {
    const frame = byLabel.get(sticky.section)!;
    const index = filled.get(frame.label) ?? 0;
    filled.set(frame.label, index + 1);
    return { nodeId: newId(), frameKey: frame.key, text: sticky.text, fill: sticky.fill, ...gridIn(frame, index, STICKY_W, STICKY_H) };
  });

  const onBoard = new Set(placed.map((item) => item.key));
  const links: PlannedLink[] = [];
  for (const item of placed) {
    if (item.madeFrom && onBoard.has(item.madeFrom)) links.push({ fromItem: item.madeFrom, toItem: item.key, relation: "produced" });
    for (const target of item.informs ?? []) if (onBoard.has(target)) links.push({ fromItem: item.key, toItem: target, relation: "informed" });
  }
  return { frames, cards, stickies: plannedStickies, links };
}

export type SowFacts = { fee_text: string; fee_amount: number | null; fee_basis: "fixed" | "monthly" | null; weeks: number };

/**
 * The SOW's terms as data (work_items.meta.sow_facts on the board's "sow" item), so code can show length and past fees
 * without a model reading prose. "$380k" is fixed, "$45k/month" monthly; anything else keeps only its text.
 */
export function sowFacts(board: Pick<DemoBoard, "fee" | "weeks">): SowFacts {
  const match = /^\$(\d+(?:\.\d+)?)(k|m)?(\/month)?$/i.exec(board.fee.trim());
  if (!match) return { fee_text: board.fee, fee_amount: null, fee_basis: null, weeks: board.weeks };
  const scale = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2] ? 1_000 : 1;
  return { fee_text: board.fee, fee_amount: Math.round(Number(match[1]) * scale), fee_basis: match[3] ? "monthly" : "fixed", weeks: board.weeks };
}

/** What the seed adds to an item's meta beyond its mime type: SOW terms, and the proposal kind. */
export function itemMeta(board: Pick<DemoBoard, "fee" | "weeks">, item: Pick<DemoItem, "key" | "kind">): Record<string, Json> {
  return {
    ...(item.key === "sow" ? { sow_facts: sowFacts(board) } : {}),
    ...(item.kind ? { deliverable_kind: item.kind } : {}),
  };
}

/**
 * Where a card added to an already seeded board goes: the next free grid slot in its frame, after the cards and
 * stickies already inside it, and how tall the frame must be to hold it.
 */
export function nextSlot(frame: { x: number; y: number; h: number }, occupied: number): { x: number; y: number; frameH: number } {
  const spot = gridIn(frame, occupied, CARD_W, CARD_H);
  return { ...spot, frameH: Math.max(frame.h, spot.y - frame.y + CARD_H + PAD) };
}

/** The outcome as one line on the engagement, for closed boards. */
export function outcomeLine(board: DemoBoard): string | null {
  if (!board.outcome) return null;
  const { ranToPlan, extended, lesson } = board.outcome;
  return `${ranToPlan ? "Ran to plan" : "Overran"}. ${extended ? "Client extended" : "Not extended"}. ${lesson}`;
}
