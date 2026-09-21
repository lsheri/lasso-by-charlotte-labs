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

export type WorkboardNodeKind = "brief" | "work_item" | "decision" | "judgment" | "draft" | "shape" | "text" | "mark";
export type WorkboardFrameKind = "foundation" | "task" | "decisions" | "outputs" | "custom" | "context";
export type WorkboardAnchor = "top" | "right" | "bottom" | "left";
export type WorkboardRelation = "informed" | "produced" | "revised" | "cited" | "context";
export const WORKBOARD_CARD_MIN_WIDTH = 180;
export const WORKBOARD_CARD_MIN_HEIGHT = 112;
export const WORKBOARD_CARD_MAX_WIDTH = 520;
export const WORKBOARD_CARD_MAX_HEIGHT = 520;
export const WORKBOARD_SHAPE_MIN_SIZE = 80;
export const WORKBOARD_SHAPE_MAX_SIZE = 4000;

/** Stored names only. The client resolves these to the Lasso paper palette. */
export const WORKBOARD_SHAPE_COLOURS = ["green", "blue", "rose", "yellow", "lavender", "grey"] as const;
export type WorkboardShapeColour = (typeof WORKBOARD_SHAPE_COLOURS)[number];

export function validWorkboardNodeGeometry(node: { kind?: WorkboardNodeKind; x?: number; y?: number; w?: number; h?: number }): boolean {
  const values = [node.x, node.y, node.w, node.h].filter((value): value is number => value !== undefined);
  if (!values.every(Number.isFinite)) return false;
  const minWidth = node.kind === "shape" ? WORKBOARD_SHAPE_MIN_SIZE : WORKBOARD_CARD_MIN_WIDTH;
  const minHeight = node.kind === "shape" ? WORKBOARD_SHAPE_MIN_SIZE : WORKBOARD_CARD_MIN_HEIGHT;
  const maxWidth = node.kind === "shape" ? WORKBOARD_SHAPE_MAX_SIZE : WORKBOARD_CARD_MAX_WIDTH;
  const maxHeight = node.kind === "shape" ? WORKBOARD_SHAPE_MAX_SIZE : WORKBOARD_CARD_MAX_HEIGHT;
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
  | { type: "frame_update"; frameId: string; expectedVersion: number; patch: Partial<Pick<WorkboardFrameInput, "x" | "y" | "w" | "h" | "label" | "ord">> }
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
export const WORKBOARD_NODE_KINDS: WorkboardNodeKind[] = ["brief", "work_item", "decision", "judgment", "draft", "shape", "text", "mark"];
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
