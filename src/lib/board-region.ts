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

/** Drawing paint leaves its chosen colour armed for the next drag. */
export function regionToolAfterDraw(fill: RegionFill): { armed: true; fill: RegionFill } {
  return { armed: true, fill };
}

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

/**
 * A workstream: anything with a name, region or not. A lane is the one
 * exception, because a lane is furniture: it carries a name for the reader
 * and still claims nothing, maps to no task and is never @-mentionable.
 */
export function regionIsWorkstream(frame: RegionFrame): boolean {
  if (isLaneFrameId(frame.id)) return false;
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
export const REGION_NAMING_LINE = "Name this and it becomes a workstream. It claims the work inside, and you can call it with @.";

const EMPTY_SPLIT: ClaimSplit = { silent: [], ask: [], frameOnly: [] };

/**
 * Kinds a named region never claims. Empty today: an answer card is a card
 * like any other, and a card inside a named region is taken in by it.
 */
export const REGION_UNCLAIMABLE_KINDS: readonly string[] = [];

export function regionClaimable(kind: string): boolean {
  return !REGION_UNCLAIMABLE_KINDS.includes(kind);
}

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

export type GroupingDragMember = { id: string; offsetX: number; offsetY: number };

/**
 * Movement is geometric, not membership. Capture the visible cards whose
 * centres are inside when the drag starts, whether the grouping is paint or a
 * named workstream. The snapshot means a card can never join halfway through.
 */
export function groupingDragSnapshot(
  grouping: { x: number; y: number; width: number; height: number },
  cards: readonly { id: string; x: number; y: number; width: number; height: number }[],
): GroupingDragMember[] {
  const right = grouping.x + grouping.width;
  const bottom = grouping.y + grouping.height;
  return cards.flatMap((card) => {
    const centreX = card.x + card.width / 2;
    const centreY = card.y + card.height / 2;
    if (centreX < grouping.x || centreX > right || centreY < grouping.y || centreY > bottom) return [];
    return [{ id: card.id, offsetX: card.x - grouping.x, offsetY: card.y - grouping.y }];
  });
}

/** Move exactly one drag-start snapshot by the grouping's new origin. */
export function moveGroupingContents<N extends { id: string; x: number; y: number }>(
  cards: readonly N[],
  members: readonly GroupingDragMember[],
  groupingAt: { x: number; y: number },
): N[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  return cards.map((card) => {
    const member = byId.get(card.id);
    return member ? { ...card, x: groupingAt.x + member.offsetX, y: groupingAt.y + member.offsetY } : card;
  });
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
