import { isDeliverableType } from "@/lib/lineage-shared";

/**
 * TRAIL (9 Nov, Liam): the trail on a piece of work shows only links Lasso saw happen or a person
 * confirmed. Never the rest of the engagement, never a model's unreviewed draft, never a count.
 *
 * - born: Lasso saw it happen. The piece was made inside, or captured from, the other one
 *   (`work_items.parent_work_item_id`).
 * - confirmed: a work link a person confirmed (`work_item_links`, status confirmed).
 * - drawn: an arrow a person drew on this board (`workboard_links`).
 *
 * Every link reads one way: the "from" piece contributed to the "to" piece. So for the piece being
 * read, links that end at it are "Made from" and links that start at it are "Used in".
 */
export type TrailHow = "born" | "confirmed" | "drawn";

export type TrailItem = {
  id: string;
  title: string;
  type: string;
  /** Null when the workspace hides vendors from this reader. */
  source_vendor: string | null;
  date: string | null;
};

export type TrailEntry = {
  item: TrailItem;
  how: TrailHow;
  relation: string | null;
  /** The confirmed link's one-line reason, when it has one. */
  note: string | null;
};

export type Trail = {
  madeFrom: TrailEntry[];
  usedIn: TrailEntry[];
  /** Which direction this kind of work opens on: a deliverable on what made it, anything else on where it went. */
  leadsWith: "made" | "used";
};

export type TrailWorkLink = {
  from_item_id: string;
  to_item_id: string;
  relation: string;
  status: string;
  source: string;
  rationale: string | null;
};

export type TrailBoardLink = { from_item_id: string; to_item_id: string; relation: string | null };

export type TrailInput = {
  itemId: string;
  itemType: string;
  /** The reader owns the piece. A reader who does not sees only links the model traced and a person confirmed. */
  isOwner: boolean;
  parentId: string | null;
  childIds: string[];
  workLinks: TrailWorkLink[];
  boardLinks: TrailBoardLink[];
  /** Only pieces the reader may open. Anything missing here drops out of the trail, uncounted. */
  readable: Map<string, TrailItem>;
};

const HOW_ORDER: Record<TrailHow, number> = { born: 0, confirmed: 1, drawn: 2 };

/** A confirmed work link the reader may see. Drafts and discarded links never reach the trail. */
export function trailShowsWorkLink(link: TrailWorkLink, isOwner: boolean): boolean {
  if (link.status !== "confirmed") return false;
  // Same rule as What fed this today (lineage.functions.ts): until the trail is read by coaches with
  // its how-words in front of them, a reader who is not the owner sees only what the model traced.
  return isOwner || link.source === "model";
}

export function trailLeadsWith(type: string): "made" | "used" {
  return isDeliverableType(type) ? "made" : "used";
}

export function buildTrail(input: TrailInput): Trail {
  const made = new Map<string, TrailEntry>();
  const used = new Map<string, TrailEntry>();
  const add = (side: Map<string, TrailEntry>, id: string, how: TrailHow, relation: string | null, note: string | null) => {
    if (id === input.itemId) return;
    const item = input.readable.get(id);
    if (!item) return;
    const held = side.get(id);
    if (held && HOW_ORDER[held.how] <= HOW_ORDER[how]) return;
    side.set(id, { item, how, relation, note });
  };

  if (input.parentId) add(made, input.parentId, "born", "produced", null);
  for (const child of input.childIds) add(used, child, "born", "produced", null);

  for (const link of input.workLinks) {
    if (!trailShowsWorkLink(link, input.isOwner)) continue;
    if (link.to_item_id === input.itemId) add(made, link.from_item_id, "confirmed", link.relation, link.rationale);
    if (link.from_item_id === input.itemId) add(used, link.to_item_id, "confirmed", link.relation, link.rationale);
  }

  for (const link of input.boardLinks) {
    if (link.to_item_id === input.itemId) add(made, link.from_item_id, "drawn", link.relation, null);
    if (link.from_item_id === input.itemId) add(used, link.to_item_id, "drawn", link.relation, null);
  }

  const ordered = (side: Map<string, TrailEntry>) =>
    [...side.values()].sort(
      (a, b) => HOW_ORDER[a.how] - HOW_ORDER[b.how] || (a.item.date ?? "").localeCompare(b.item.date ?? ""),
    );

  return { madeFrom: ordered(made), usedIn: ordered(used), leadsWith: trailLeadsWith(input.itemType) };
}

/** Board arrows join nodes; the trail joins work. Arrows to anything that is not a work card drop out. */
export function boardLinksToWork(
  nodes: { id: string; work_item_id: string | null }[],
  links: { from_node_id: string | null; to_node_id: string | null; relation: string | null }[],
): TrailBoardLink[] {
  const workOf = new Map(nodes.filter((node) => node.work_item_id).map((node) => [node.id, node.work_item_id as string]));
  const out: TrailBoardLink[] = [];
  for (const link of links) {
    const from = link.from_node_id ? workOf.get(link.from_node_id) : undefined;
    const to = link.to_node_id ? workOf.get(link.to_node_id) : undefined;
    if (from && to && from !== to) out.push({ from_item_id: from, to_item_id: to, relation: link.relation });
  }
  return out;
}
