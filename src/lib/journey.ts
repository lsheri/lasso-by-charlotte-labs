/**
 * Pass 110: the journey. A shareable trace of how one deliverable grew out of
 * the record, computed entirely from rows that already exist.
 *
 * This is a wrapped of THE WORK, never of the person. Nothing here counts
 * prompts, rates anyone, or scores anything: the spine holds the sources, the
 * conversations, the questions actually asked of the record, and the finished
 * thing. An undated item shows no date, because inventing one would be a lie.
 */

import type { SpanStatus } from "@/lib/span-provenance-shared";

export type JourneyKind = "origin" | "conversation" | "deliverable";

/** Just enough of a work item for the spine. Provider dates may be absent. */
export type JourneyItemInput = {
  id: string;
  title: string;
  type: string;
  source_vendor?: string | null | undefined;
  /** The day the work carries, when the record actually holds one. */
  work_date?: string | null | undefined;
  /** The provider's own timestamp, when there is one. */
  created_at_source?: string | null | undefined;
  /** When Lasso captured it. Only ever a tiebreak, never a shown date. */
  captured_at: string;
  /** Turns in this thread, a fact about the record. Absent when not a thread. */
  turn_count?: number | null | undefined;
};

/** One real span_link: a question asked of the record and what it found. */
export type JourneyStitchInput = {
  id: string;
  status: SpanStatus;
  quote: string | null;
  to_item_id: string | null;
  to_turn_no: number | null;
  created_at: string;
};

export type JourneyStitch = {
  id: string;
  status: SpanStatus;
  quote: string | null;
  to_turn_no: number | null;
};

export type JourneyNode = {
  id: string;
  kind: JourneyKind;
  title: string;
  type: string;
  sourceVendor: string | null;
  /** The provider date, or null when the record does not hold one. */
  date: string | null;
  typeLabel: string;
  turnCount: number | null;
  stitches: JourneyStitch[];
};

export type Journey = {
  /** False when the record is too thin to draw anything honest. */
  enough: boolean;
  nodes: JourneyNode[];
};

/** The refusal line. Quiet, truthful, and cheaper than a theatrical one node. */
export const JOURNEY_THIN_LINE =
  "This work does not have enough of a record yet to show a journey. Connect the conversations and sources that fed it.";

export const JOURNEY_TITLE = "How this work grew";

/**
 * A colleague may open a shipped card whose engagement they are not part of.
 * The record comes back empty under their own access, and saying so is the only
 * honest thing: it is not a thin record, it is simply not theirs to read.
 */
export const JOURNEY_VIEWER_LINE =
  "The record behind this work is not shared with you. The card is what its owner shipped.";


/** At least this many upstream items, or there is no journey to draw. */
export const JOURNEY_MIN_UPSTREAM = 2;

/** The provider date this item genuinely carries, or null. Capture is not one. */
export function providerDate(item: JourneyItemInput): string | null {
  return item.work_date ?? item.created_at_source ?? null;
}

/** The one line of type vocabulary the journey speaks. */
export function journeyTypeLabel(type: string): string {
  if (type === "email") return "Email";
  if (type === "ai_thread") return "Conversation";
  if (type === "deck") return "Deck";
  return "Document";
}

/**
 * The one comparator: a real provider date decides when both sides have one,
 * otherwise the confirmed workflow order decides, and capture time is only ever
 * the tiebreak. The same chain the rest of the app already reads by.
 */
export function compareJourneyItems(
  a: JourneyItemInput,
  b: JourneyItemInput,
  order: Record<string, number>,
): number {
  const da = providerDate(a);
  const db = providerDate(b);
  if (da && db && da !== db) return da.localeCompare(db);
  const ra = order[a.id] ?? Number.POSITIVE_INFINITY;
  const rb = order[b.id] ?? Number.POSITIVE_INFINITY;
  if (ra !== rb) return ra - rb;
  const ca = a.captured_at.localeCompare(b.captured_at);
  return ca !== 0 ? ca : a.id.localeCompare(b.id);
}

function kindOf(item: JourneyItemInput, anchorId: string): JourneyKind {
  if (item.id === anchorId) return "deliverable";
  return item.type === "ai_thread" ? "conversation" : "origin";
}

function toNode(item: JourneyItemInput, kind: JourneyKind): JourneyNode {
  return {
    id: item.id,
    kind,
    title: item.title,
    type: item.type,
    sourceVendor: item.source_vendor ?? null,
    date: providerDate(item),
    typeLabel: journeyTypeLabel(item.type),
    turnCount: kind === "conversation" ? (item.turn_count ?? null) : null,
    stitches: [],
  };
}

/**
 * The spine: origins first, then conversations, then the deliverable last.
 * Judgment moments are ONLY the real stitches, each hung off the conversation
 * it actually points at. A stitch whose source is not on the spine is dropped
 * rather than guessed into place.
 */
export function buildJourney(input: {
  anchorId: string;
  items: JourneyItemInput[];
  order?: Record<string, number> | undefined;
  stitches?: JourneyStitchInput[] | undefined;
}): Journey {
  const order = input.order ?? {};
  const anchor = input.items.find((item) => item.id === input.anchorId) ?? null;
  const upstream = input.items.filter((item) => item.id !== input.anchorId);

  if (!anchor || upstream.length < JOURNEY_MIN_UPSTREAM) return { enough: false, nodes: [] };

  const sorted = (kind: JourneyKind) =>
    upstream
      .filter((item) => kindOf(item, input.anchorId) === kind)
      .sort((a, b) => compareJourneyItems(a, b, order))
      .map((item) => toNode(item, kind));

  const nodes = [...sorted("origin"), ...sorted("conversation"), toNode(anchor, "deliverable")];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const stitches = [...(input.stitches ?? [])].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  for (const stitch of stitches) {
    if (!stitch.to_item_id) continue;
    const node = byId.get(stitch.to_item_id);
    if (!node || node.kind === "deliverable") continue;
    node.stitches.push({
      id: stitch.id,
      status: stitch.status,
      quote: stitch.quote,
      to_turn_no: stitch.to_turn_no,
    });
  }

  return { enough: true, nodes };
}

/**
 * When each part of the drawing starts, in milliseconds. Nodes arrive with
 * their segment; the whole sequence stays inside four seconds for a record of
 * a normal size, and a skip drops every delay to zero.
 */
export const JOURNEY_STEP_MS = 260;
export const JOURNEY_MAX_TOTAL_MS = 4000;

export function journeyDelayMs(index: number, count: number): number {
  const step = count > 1 ? Math.min(JOURNEY_STEP_MS, JOURNEY_MAX_TOTAL_MS / count) : 0;
  return Math.round(index * step);
}
