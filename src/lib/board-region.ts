/**
 * W3: a drawn region is paint until it is named.
 *
 * A person draws a rectangle and colours it. What that rectangle IS depends on
 * one thing only: whether it carries a name.
 *
 * No name: it is paint. It claims nothing, it holds no board space, it never
 * appears where workstreams appear, and it can never be an answer to what fed
 * something.
 * Named: it is a workstream. It claims the cards fully inside it and maps to
 * a task, exactly as a drawn workstream always has.
 * Name cleared: it is paint again and what it claimed is released.
 *
 * Pure logic only. No React, no network. A region is a frame, because frames
 * already carry a label, membership, ordering, an optional task and a guard.
 */

import { splitClaims, type ClaimCandidate, type ClaimSplit, type DrawRect } from "@/lib/workstream-draw";

/** The stored fill names. Sixteen, exactly as the record constrains them. */
export const REGION_FILLS = [
  "green-faded",
  "green-vivid",
  "blue-faded",
  "blue-vivid",
  "rose-faded",
  "rose-vivid",
  "yellow-faded",
  "yellow-vivid",
  "lavender-faded",
  "lavender-vivid",
  "slate-faded",
  "slate-vivid",
  "paper-white",
  "paper-warm",
  "paper-cool",
  "paper-sand",
] as const;

export type RegionFill = (typeof REGION_FILLS)[number];

export function isRegionFill(value: unknown): value is RegionFill {
  return typeof value === "string" && (REGION_FILLS as readonly string[]).includes(value);
}

/** A region keeps its own id prefix, so no workstream surface ever sees it. */
export const REGION_FRAME_PREFIX = "region:";

export function isRegionFrameId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(REGION_FRAME_PREFIX);
}

export function newRegionFrameId(key: string): string {
  return `${REGION_FRAME_PREFIX}${key}`;
}

export type RegionFrame = {
  id: string;
  label?: string | null | undefined;
  fill?: RegionFill | string | null | undefined;
};

export function regionName(label: string | null | undefined): string | null {
  const trimmed = (label ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Paint: a drawn region with nothing written on it. */
export function regionIsPaint(frame: RegionFrame): boolean {
  return isRegionFrameId(frame.id) && regionName(frame.label) === null;
}

/** A workstream: anything with a name, region or not. */
export function regionIsWorkstream(frame: RegionFrame): boolean {
  return regionName(frame.label) !== null;
}

/** Paint holds no board space, so a new card may land on top of it. */
export function regionOccupies(frame: RegionFrame): boolean {
  return !regionIsPaint(frame);
}

/**
 * The sentence shown beside the name field the first time someone names a
 * region. Plain words, where they are already looking.
 */
export const REGION_NAMING_LINE = "Name this and it becomes a workstream, taking in the cards inside it.";

const EMPTY_SPLIT: ClaimSplit = { silent: [], ask: [], frameOnly: [] };

/**
 * What a region claims. Paint claims nothing at all. A named region claims
 * the cards fully inside it, and a card that already sits in another
 * workstream is asked about once, never refiled silently.
 */
export function regionClaims(
  frame: RegionFrame,
  rect: DrawRect,
  cards: readonly ClaimCandidate[],
  options: { defaultHomeFrameIds?: readonly string[]; namedFrameIds?: readonly string[] } = {},
): ClaimSplit {
  if (!regionIsWorkstream(frame)) return { silent: [], ask: [], frameOnly: [] };
  return splitClaims(rect, cards, options);
}

export type RegionNameChange = {
  becomes: "workstream" | "paint";
  /** Cards to file, once the person has answered any overlap prompt. */
  claim: ClaimCandidate[];
  /** Card ids to let go of, because the region is paint again. */
  release: string[];
};

/**
 * Naming and unnaming, as one answer. Nothing here writes: the caller files
 * through the existing move path and releases through the board.
 */
export function regionNameChange(
  frame: RegionFrame,
  nextLabel: string | null | undefined,
  rect: DrawRect,
  cards: readonly ClaimCandidate[],
  options: { defaultHomeFrameIds?: readonly string[]; namedFrameIds?: readonly string[] } = {},
): RegionNameChange {
  const next = regionName(nextLabel);
  if (next === null) {
    return {
      becomes: "paint",
      claim: [],
      release: cards.filter((card) => card.frame === frame.id).map((card) => card.id),
    };
  }
  const split = regionClaims({ ...frame, label: next }, rect, cards, options);
  return { becomes: "workstream", claim: [...split.silent, ...split.frameOnly], release: [] };
}

/**
 * One piece of work is filed once. Two cards standing for the same work item
 * produce one move, never two.
 */
export function filingPlan(
  taskId: string,
  cards: readonly ClaimCandidate[],
): { workItemId: string; taskId: string }[] {
  const seen = new Set<string>();
  const plan: { workItemId: string; taskId: string }[] = [];
  for (const card of cards) {
    if (!card.workItemId || seen.has(card.workItemId)) continue;
    seen.add(card.workItemId);
    plan.push({ workItemId: card.workItemId, taskId });
  }
  return plan;
}

/**
 * W3.1: what a naming or unnaming actually filed. Only cards standing for a
 * piece of work count, and one piece of work counts once however many cards
 * stand for it. A brief card sitting inside the rectangle is not a claim.
 */
export function filedWorkCount(cards: readonly ClaimCandidate[]): number {
  const seen = new Set<string>();
  for (const card of cards) {
    if (card.workItemId) seen.add(card.workItemId);
  }
  return seen.size;
}

/**
 * Moving a card between regions is filing, never provenance. What fed
 * something is stored, dated links, so the links come back untouched, as the
 * very same list.
 */
export function regionFrameMove<N extends { id: string; frame?: string | null | undefined }, L>(
  nodes: readonly N[],
  links: readonly L[],
  nodeId: string,
  frameId: string | null,
): { nodes: N[]; links: readonly L[] } {
  return {
    nodes: nodes.map((node) => (node.id === nodeId ? { ...node, frame: frameId } : node)),
    links,
  };
}

/**
 * The craft decision: a vivid fill would fight the cards sitting on it, so a
 * vivid token drives the edge and the name and the fill itself stays soft.
 */
export function regionFillStyle(fill: RegionFill | string | null | undefined): { fill: string; edge: string; name: string } {
  const token = isRegionFill(fill) ? fill : "paper-white";
  const [family = "paper", strength = "white"] = token.split("-");
  if (family === "paper") {
    return { fill: `var(--nb-region-paper-${strength})`, edge: "var(--nb-line-hairline)", name: "var(--nb-mid)" };
  }
  const soft = `var(--nb-region-${family}-soft)`;
  if (strength === "vivid") {
    return { fill: soft, edge: `var(--nb-region-${family}-vivid)`, name: `var(--nb-region-${family}-vivid)` };
  }
  return { fill: soft, edge: `var(--nb-region-${family}-soft-edge)`, name: "var(--nb-mid)" };
}
