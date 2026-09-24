/**
 * Canvas Lab Phase 3 Slice 1: the client-safe contract for the durable
 * Workboard. No server imports live here; components and tests may use every
 * type and vocabulary in this file.
 *
 * Canonical chats, work, and decisions stay in their own tables. A Workboard
 * node either references one of those records or is an authored judgment
 * card. Comments, highlights, excerpt snapshots, branch prompts, and board
 * instructions are not part of Slice 1 and stay browser-local.
 */

export type WorkboardNodeKind = "brief" | "work_item" | "decision" | "judgment" | "draft" | "shape" | "text" | "mark" | "answer" | "sticky";
export type WorkboardFrameKind = "foundation" | "task" | "decisions" | "outputs" | "custom" | "context";
export type WorkboardAnchor = "top" | "right" | "bottom" | "left";
export type WorkboardRelation = "informed" | "produced" | "revised" | "cited" | "context";
export const WORKBOARD_CARD_MIN_WIDTH = 180;
export const WORKBOARD_CARD_MIN_HEIGHT = 112;
export const WORKBOARD_CARD_MAX_WIDTH = 520;
export const WORKBOARD_CARD_MAX_HEIGHT = 520;
export const WORKBOARD_SHAPE_MIN_SIZE = 80;
export const WORKBOARD_SHAPE_MAX_SIZE = 4000;
export const WORKBOARD_TEXT_MIN_WIDTH = 80;
export const WORKBOARD_TEXT_MIN_HEIGHT = 24;
export const WORKBOARD_TEXT_MAX_SIZE = 4000;
export const WORKBOARD_STICKY_MIN_WIDTH = 120;
export const WORKBOARD_STICKY_MIN_HEIGHT = 90;
export const WORKBOARD_STICKY_MAX_SIZE = 4000;
export const WORKBOARD_STICKY_DEFAULT_SIZE = { width: 200, height: 140 } as const;
export const WORKBOARD_STICKY_FILLS = ["yellow", "green", "blue", "pink", "grey"] as const;
export type WorkboardStickyFill = (typeof WORKBOARD_STICKY_FILLS)[number];
/**
 * The size a card gets when it is created rather than drawn by hand: the
 * client model, the placement grid and the server all read this one value, so
 * a card added on the board and a card created for you are the same shape.
 */
export const WORKBOARD_CARD_DEFAULT_SIZE = { width: 260, height: 220 } as const;

/** Stored names only. The client resolves these to the Lasso paper palette. */
export const WORKBOARD_SHAPE_COLOURS = ["green", "blue", "rose", "yellow", "lavender", "grey"] as const;
export type WorkboardShapeColour = (typeof WORKBOARD_SHAPE_COLOURS)[number];
export const WORKBOARD_TEXT_SIZES = ["small", "body", "label", "heading"] as const;
export const WORKBOARD_TEXT_WEIGHTS = ["regular", "medium", "bold"] as const;
export const WORKBOARD_TEXT_COLOURS = ["ink", "graphite", "mid", "green", "blue"] as const;
export const WORKBOARD_TEXT_MAX_LENGTH = 500;
export type WorkboardTextSize = (typeof WORKBOARD_TEXT_SIZES)[number];
export type WorkboardTextWeight = (typeof WORKBOARD_TEXT_WEIGHTS)[number];
export type WorkboardTextColour = (typeof WORKBOARD_TEXT_COLOURS)[number];
export type WorkboardTextBody = { text: string; size: WorkboardTextSize; weight: WorkboardTextWeight; colour: WorkboardTextColour };

/**
 * Decorations are never a source: they carry no record reference, cannot be
 * connected, and are skipped by context selection, the marquee, region
 * membership and placement. A sticky is one of them.
 */
const WORKBOARD_DECORATION_KINDS: readonly WorkboardNodeKind[] = ["shape", "text", "mark", "sticky"];

export function isWorkboardDecorationKind(kind: string): kind is WorkboardNodeKind {
  return WORKBOARD_DECORATION_KINDS.includes(kind as WorkboardNodeKind);
}

export function parseWorkboardTextBody(value: unknown): WorkboardTextBody | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const body = parsed as Record<string, unknown>;
    if (Object.keys(body).sort().join(",") !== "colour,size,text,weight") return null;
    if (typeof body["text"] !== "string" || body["text"].length > WORKBOARD_TEXT_MAX_LENGTH) return null;
    if (!WORKBOARD_TEXT_SIZES.includes(body["size"] as WorkboardTextSize)) return null;
    if (!WORKBOARD_TEXT_WEIGHTS.includes(body["weight"] as WorkboardTextWeight)) return null;
    if (!WORKBOARD_TEXT_COLOURS.includes(body["colour"] as WorkboardTextColour)) return null;
    return body as WorkboardTextBody;
  } catch {
    return null;
  }
}

export type WorkboardStickyBody = WorkboardTextBody & { fill: WorkboardStickyFill };

export function parseWorkboardStickyBody(value: unknown): WorkboardStickyBody | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const body = parsed as Record<string, unknown>;
    if (Object.keys(body).sort().join(",") !== "colour,fill,size,text,weight") return null;
    if (!WORKBOARD_STICKY_FILLS.includes(body["fill"] as WorkboardStickyFill)) return null;
    const { fill, ...rest } = body;
    const text = parseWorkboardTextBody(JSON.stringify(rest));
    return text ? { ...text, fill: fill as WorkboardStickyFill } : null;
  } catch {
    return null;
  }
}

export function serializeWorkboardStickyBody(body: WorkboardStickyBody): string {
  return JSON.stringify({ text: body.text, size: body.size, weight: body.weight, colour: body.colour, fill: body.fill });
}

export function serializeWorkboardTextBody(body: WorkboardTextBody): string {
  return JSON.stringify(body);
}

export function validWorkboardNodeGeometry(node: { kind?: WorkboardNodeKind; x?: number; y?: number; w?: number; h?: number }): boolean {
  const values = [node.x, node.y, node.w, node.h].filter((value): value is number => value !== undefined);
  if (!values.every(Number.isFinite)) return false;
  if (node.kind === "sticky") {
    if (node.w !== undefined && (node.w < WORKBOARD_STICKY_MIN_WIDTH || node.w > WORKBOARD_STICKY_MAX_SIZE)) return false;
    return node.h === undefined || (node.h >= WORKBOARD_STICKY_MIN_HEIGHT && node.h <= WORKBOARD_STICKY_MAX_SIZE);
  }
  const minWidth = node.kind === "shape" ? WORKBOARD_SHAPE_MIN_SIZE : node.kind === "text" ? WORKBOARD_TEXT_MIN_WIDTH : WORKBOARD_CARD_MIN_WIDTH;
  const minHeight = node.kind === "shape" ? WORKBOARD_SHAPE_MIN_SIZE : node.kind === "text" ? WORKBOARD_TEXT_MIN_HEIGHT : WORKBOARD_CARD_MIN_HEIGHT;
  const maxWidth = node.kind === "shape" ? WORKBOARD_SHAPE_MAX_SIZE : node.kind === "text" ? WORKBOARD_TEXT_MAX_SIZE : WORKBOARD_CARD_MAX_WIDTH;
  const maxHeight = node.kind === "shape" ? WORKBOARD_SHAPE_MAX_SIZE : node.kind === "text" ? WORKBOARD_TEXT_MAX_SIZE : WORKBOARD_CARD_MAX_HEIGHT;
  if (node.w !== undefined && (node.w < minWidth || node.w > maxWidth)) return false;
  return node.h === undefined || (node.h >= minHeight && node.h <= maxHeight);
}
export type WorkboardJudgmentType =
  | "added_constraint"
  | "corrected_ai"
  | "rejected_option"
  | "requested_evidence"
  | "changed_direction"
  | "accepted_but_rewrote";

export type WorkboardFrameDto = {
  id: string;
  key: string;
  kind: WorkboardFrameKind;
  taskId: string | null;
  label: string | null;
  /** W3: the stored fill name of a drawn region. Null on an ordinary outline. */
  fill: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  ord: number;
  version: number;
};

export type WorkboardNodeDto = {
  id: string;
  frameId: string | null;
  kind: WorkboardNodeKind;
  workItemId: string | null;
  decisionId: string | null;
  authorProfileId: string;
  authorName: string;
  title: string;
  body: string;
  judgmentType: WorkboardJudgmentType | null;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  version: number;
  /** False when the referenced record exists but this caller may not read it. */
  referenceReadable: boolean;
  /** When the row was saved. The only date an answer card shows. */
  createdAt?: string | null;
  /** Set when the work item this card stood for was deleted from the inbox. */
  linkedItemRemovedAt?: string | null;
};

export type WorkboardLinkDto = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromAnchor: WorkboardAnchor;
  toAnchor: WorkboardAnchor;
  relation: WorkboardRelation;
  authorProfileId: string;
  version: number;
};

export type WorkboardDto = {
  id: string;
  engagementId: string;
  version: number;
  frames: WorkboardFrameDto[];
  nodes: WorkboardNodeDto[];
  links: WorkboardLinkDto[];
  viewerProfileId: string;
  /** Non-coach engagement members may arrange shared structure. */
  canEditStructure: boolean;
  /** An archived context outline records that automatic creation must stay off. */
  archivedContextFrame: { id: string; version: number } | null;
};

export type WorkboardFrameInput = {
  key: string;
  kind: WorkboardFrameKind;
  taskId?: string | null;
  label?: string | null;
  /** W3: the stored fill name of a drawn region. Null on an ordinary outline. */
  fill?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  ord: number;
};

export type WorkboardNodeInput = {
  /** Client-side temporary key, echoed back in the materialize mapping. */
  clientKey: string;
  frameKey: string | null;
  kind: WorkboardNodeKind;
  workItemId?: string | null;
  decisionId?: string | null;
  title?: string;
  body?: string;
  judgmentType?: WorkboardJudgmentType | null;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
};

export type WorkboardCommand =
  | { type: "materialize"; frames: WorkboardFrameInput[]; nodes: WorkboardNodeInput[] }
  | { type: "frame_create"; frame: WorkboardFrameInput }
  | { type: "frame_update"; frameId: string; expectedVersion: number; patch: Partial<Pick<WorkboardFrameInput, "x" | "y" | "w" | "h" | "label" | "ord" | "fill" | "taskId">> }
  | { type: "frame_archive"; frameId: string; expectedVersion: number }
  | { type: "frame_restore"; frameId: string; expectedVersion: number; patch?: Pick<WorkboardFrameInput, "x" | "y" | "w" | "h"> }
  | { type: "node_create"; node: WorkboardNodeInput }
  | {
      type: "node_update";
      nodeId: string;
      expectedVersion: number;
      patch: Partial<{ x: number; y: number; w: number; h: number; frameId: string | null; hidden: boolean; title: string; body: string }>;
    }
  | { type: "node_archive"; nodeId: string; expectedVersion: number }
  | { type: "node_restore"; nodeId: string; expectedVersion: number }
  | { type: "link_create"; fromNodeId: string; fromAnchor: WorkboardAnchor; toNodeId: string; toAnchor: WorkboardAnchor; relation?: WorkboardRelation }
  | { type: "link_update"; linkId: string; expectedVersion: number; relation: WorkboardRelation }
  | { type: "link_archive"; linkId: string; expectedVersion: number };

/** JSON-safe snapshot of the newer row shipped with a conflict. */
export type WorkboardRowSnapshot = Record<string, string | number | boolean | null>;

export type WorkboardMutationResult =
  | {
      status: "saved";
      boardId: string;
      boardVersion: number;
      /** New durable ids, keyed by client key or created entity. */
      created?: { nodes?: Record<string, string>; frames?: Record<string, string>; linkId?: string; nodeId?: string; frameId?: string };
      /** Fresh versions for entities the command touched. */
      versions: Record<string, number>;
    }
  | { status: "conflict"; entityKind: "frame" | "node" | "link"; entityId: string; latestVersion: number; latest: WorkboardRowSnapshot }
  | { status: "forbidden" }
  | { status: "validation_error"; message: string };

export const WORKBOARD_RELATIONS: WorkboardRelation[] = ["informed", "produced", "revised", "cited", "context"];
export const WORKBOARD_ANCHORS: WorkboardAnchor[] = ["top", "right", "bottom", "left"];
/**
 * W3: the shape node is retired. A drawn region is a frame now, so nothing
 * writes a shape again; the kind stays in the type only so old code paths
 * still read, and the server refuses it the way it refuses a mark.
 */
export const WORKBOARD_NODE_KINDS: WorkboardNodeKind[] = ["brief", "work_item", "decision", "judgment", "draft", "text", "mark", "answer", "sticky"];
export const WORKBOARD_JUDGMENT_TYPES: WorkboardJudgmentType[] = [
  "added_constraint",
  "corrected_ai",
  "rejected_option",
  "requested_evidence",
  "changed_direction",
  "accepted_but_rewrote",
];

export const RELATION_LABELS: Record<WorkboardRelation, string> = {
  informed: "informed",
  produced: "produced",
  revised: "revised",
  cited: "cited",
  context: "context",
};
