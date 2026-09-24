/**
 * Canvas Lab, as pure state.
 *
 * No React, no DOM, no database. Every move the lab makes resolves through
 * here, so the pointer path, the keyboard path and the composer cannot drift
 * apart. Nothing in this module is persisted: the lab is a prototype and its
 * whole state lives in memory for one visit.
 */

import { dragTo, snapPoint, type Point } from "@/lib/canvas-drag";
import type { LabNodeEventKind } from "@/components/canvas-lab/canvas-lab-telemetry";
import {
  WORKBOARD_CARD_MAX_HEIGHT,
  WORKBOARD_CARD_MAX_WIDTH,
  WORKBOARD_CARD_MIN_HEIGHT,
  WORKBOARD_CARD_DEFAULT_SIZE,
  WORKBOARD_CARD_MIN_WIDTH,
  WORKBOARD_SHAPE_MAX_SIZE,
  WORKBOARD_SHAPE_MIN_SIZE,
  WORKBOARD_TEXT_MAX_SIZE,
  WORKBOARD_TEXT_MIN_HEIGHT,
  WORKBOARD_TEXT_MIN_WIDTH,
  isWorkboardDecorationKind,
  parseWorkboardTextBody,
  parseWorkboardStickyBody,
  WORKBOARD_STICKY_MIN_WIDTH,
  WORKBOARD_STICKY_MIN_HEIGHT,
  WORKBOARD_STICKY_MAX_SIZE,
  type WorkboardStickyFill,
  type WorkboardCommand,
  type WorkboardDto,
  type WorkboardNodeDto,
  type WorkboardRelation,
  type WorkboardShapeColour,
  type WorkboardTextColour,
  type WorkboardTextSize,
  type WorkboardTextWeight,
} from "@/lib/canvas-lab-shared";
import { clampZoom } from "@/lib/canvas-zoom";
import { isWorkstreamFrameId } from "@/lib/context-region";
import { isContextFrameId } from "@/lib/context-region";
import { isRegionFrameId } from "@/lib/board-region";
import { isTrailFrameId } from "@/lib/reasoning-trail";
import { placeAddedCards } from "@/lib/workboard-placement";

export type LabNodeKind = "brief" | "task" | "work" | "decision" | "chat" | "source" | "ai_work" | "judgment" | "deliverable" | "shape" | "text" | "answer" | "sticky";
export type LabJudgmentType = "added_constraint" | "corrected_ai" | "rejected_option" | "requested_evidence" | "changed_direction" | "accepted_but_rewrote";
export type LabTemplateKind = "source" | "ai_work" | "judgment" | "decision" | "deliverable";
/**
 * The cards a person can create from the board. A kept answer is not one of
 * them: it only ever arrives as the result of keeping an answer.
 */
export const LAB_TEMPLATE_KINDS: readonly LabTemplateKind[] = ["source", "ai_work", "judgment", "decision", "deliverable"];

/** Who the thing belongs to, which is what decides the offered actions. */
export type LabOwnership = "yours" | "teammate" | "draft";

/** Display ownership without changing the edit and menu permission semantics. */
export function ownerLabel(node: LabNode): "yours" | "teammate" | "local draft" {
  if (node.kind === "chat") return "local draft";
  if (node.kind === "judgment") {
    if (!node.durableId) return "local draft";
    return node.ownership === "teammate" ? "teammate" : "yours";
  }
  if (node.ownership === "draft") return "local draft";
  return node.ownership;
}

export type LabFrameId = string;
export type LabAnchor = "top" | "right" | "bottom" | "left";
export type LabResizeCorner = "nw" | "ne" | "se" | "sw";
export type LabStructureMode = "structured" | "freeform";

export type LabNode = {
  id: string;
  kind: LabNodeKind;
  /** A blank board has no outlines at all, so a card can belong to none. */
  frame?: LabFrameId | null;
  title: string;
  /** One quiet line under the title in Cards, the preview header in Live. */
  summary: string;
  /** Short type word shown in the card's micro label. */
  typeLabel: string;
  ownership: LabOwnership;
  /** Present only when the card stands for a real work element. */
  workItemId?: string | undefined;
  /** True when the real work element this card stands for is a deliverable. */
  deliverable?: boolean;
  /** Local chat cards only. */
  prompt?: string | undefined;
  contextIds?: string[];
  judgmentType?: LabJudgmentType;
  local?: boolean;
  /** Stable per-card key so a retried save cannot write the card twice. */
  clientKey?: string;
  /** Durable Slice 1 identity, when this card is backed by a Workboard row. */
  durableId?: string;
  durableVersion?: number;
  /** Set when the work item this card stood for was deleted from the inbox. */
  linkedItemRemovedAt?: string | null;
  /** Closed palette token for a decorative colour block. */
  colour?: WorkboardShapeColour;
  textSize?: WorkboardTextSize;
  textWeight?: WorkboardTextWeight;
  textColour?: WorkboardTextColour;
  /** A sticky's paper fill. */
  stickyFill?: WorkboardStickyFill;
  /** Kept answers only: when the row was saved, and who asked. */
  createdAt?: string | null;
  authorName?: string;


  x: number;
  y: number;
  width: number;
  height: number;
};

export type LabFrame = {
  id: LabFrameId;
  /** W3: empty on a drawn region that has not been named. */
  name: string;
  /** W3: the stored fill name of a drawn region. */
  fill?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  local?: boolean;
  durableId?: string;
  durableVersion?: number;
};

export const CARD_MIN_WIDTH = 260;
export const CARD_MIN_HEIGHT = 180;
export const CARD_WIDTH = WORKBOARD_CARD_DEFAULT_SIZE.width;
export const CARD_HEIGHT = WORKBOARD_CARD_DEFAULT_SIZE.height;
export const CARD_MAX_WIDTH = WORKBOARD_CARD_MAX_WIDTH;
export const CARD_MAX_HEIGHT = WORKBOARD_CARD_MAX_HEIGHT;
export const FRAME_MIN_WIDTH = 260;
export const FRAME_MIN_HEIGHT = 220;
export const CARD_GAP_Y = CARD_HEIGHT + 32;
export const FRAME_PADDING = 24;

/** Fit content shares the exact same floor as pointer and keyboard resizing. */
export function fitCardRect(node: Pick<LabNode, "width" | "height">, measuredHeight: number): Pick<LabNode, "width" | "height"> {
  return {
    width: Math.max(CARD_MIN_WIDTH, Math.min(CARD_MAX_WIDTH, node.width)),
    height: Math.max(CARD_MIN_HEIGHT, Math.min(CARD_MAX_HEIGHT, measuredHeight || node.height)),
  };
}

export type LabLink = { id: string; fromId: string; toId: string; fromAnchor: LabAnchor; toAnchor: LabAnchor; durableId?: string; durableVersion?: number; relation?: WorkboardRelation };

export const REASONING_STEPS: { kind: LabTemplateKind; label: string }[] = [
  { kind: "source", label: "Source / Context" },
  { kind: "ai_work", label: "AI work" },
  { kind: "judgment", label: "Human judgment" },
  { kind: "decision", label: "Decision" },
  { kind: "deliverable", label: "Deliverable" },
];

export const JUDGMENT_TYPES: { value: LabJudgmentType; label: string }[] = [
  { value: "added_constraint", label: "Added constraint" },
  { value: "corrected_ai", label: "Corrected AI" },
  { value: "rejected_option", label: "Rejected option" },
  { value: "requested_evidence", label: "Requested evidence" },
  { value: "changed_direction", label: "Changed direction" },
  { value: "accepted_but_rewrote", label: "Accepted but rewrote" },
];

const FRAME_WIDTH = 430;
const FRAME_HEIGHT = 520;
const FRAME_GAP = 36;
const FRAME_COLUMNS = 4;

/** Consulting-work zones, derived from the engagement's real workstreams. */
export function createLabFrames(tasks: { id: string; name: string }[]): LabFrame[] {
  const workstreams =
    tasks.length > 0
      ? tasks.map((task) => ({ id: `task:${task.id}`, name: task.name }))
      : [{ id: "workstreams", name: "Workstreams" }];
  const definitions = [
    { id: "foundation", name: "Foundation" },
    ...workstreams,
    { id: "decisions", name: "Decisions" },
    { id: "outputs", name: "Outputs" },
  ];
  return definitions.map((definition, index) => ({
    ...definition,
    x: 60 + (index % FRAME_COLUMNS) * (FRAME_WIDTH + FRAME_GAP),
    y: 420 + Math.floor(index / FRAME_COLUMNS) * (FRAME_HEIGHT + FRAME_GAP),
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
  }));
}

/** Grow only a fresh virtual seed so every opening card is inside its frame. */
export function sizeSeedFrames(frames: LabFrame[], nodes: LabNode[]): LabFrame[] {
  return frames.map((frame) => {
    const members = nodes.filter((node) => node.frame === frame.id);
    if (members.length === 0) return frame;
    const right = Math.max(...members.map((node) => node.x + node.width));
    const bottom = Math.max(...members.map((node) => node.y + node.height));
    return {
      ...frame,
      width: Math.max(frame.width, right - frame.x + FRAME_PADDING),
      height: Math.max(frame.height, bottom - frame.y + 48),
    };
  });
}

/** The tightest frame under a point, so a grown or overlapping frame never wins. */
export function frameContainingPoint(frames: LabFrame[], point: Point): LabFrame | null {
  const holding = frames.filter((frame) => point.x >= frame.x && point.x <= frame.x + frame.width && point.y >= frame.y && point.y <= frame.y + frame.height);
  if (holding.length === 0) return null;
  return holding.reduce((smallest, frame) => (frame.width * frame.height < smallest.width * smallest.height ? frame : smallest));
}

export function dropPromptFrame(node: LabNode, frames: LabFrame[], mode: LabStructureMode, editable: boolean): LabFrame | null {
  if (mode !== "structured" || !editable) return null;
  const target = frameContainingPoint(frames, { x: node.x + node.width / 2, y: node.y + node.height / 2 });
  return target && target.id !== node.frame ? target : null;
}

/**
 * What a pointer drag ends as, decided from the pointerup event alone.
 *
 * React may not have rendered the last pointermove when the pointer comes up
 * (fast drags, and every automated drag), so the live node can still sit at
 * its origin. Reading the position from the event keeps the save and the drop
 * prompt honest.
 */
export function dragEndDecision(input: {
  origin: Point;
  from: Point;
  pointer: Point;
  zoom: number;
  node: LabNode;
  frames: LabFrame[];
  mode: LabStructureMode;
  editable: boolean;
}): { position: Point | null; promptFrameId: string | null } {
  const { origin, from, pointer, zoom, node, frames, mode, editable } = input;
  if (Math.hypot(pointer.x - from.x, pointer.y - from.y) < 4) return { position: null, promptFrameId: null };
  const position = dragTo(origin, { x: (pointer.x - from.x) / zoom, y: (pointer.y - from.y) / zoom });
  if (position.x === origin.x && position.y === origin.y) return { position: null, promptFrameId: null };
  const target = dropPromptFrame({ ...node, x: position.x, y: position.y }, frames, mode, editable);
  return { position, promptFrameId: target ? target.id : null };
}

/** Counter-scale stage controls so their visible size stays constant. */
export function labInverseZoom(zoom: number): number {
  return 1 / clampZoom(zoom);
}

/** Keep a newly-created card visible without disturbing an already-visible view. */
export function panToRevealNode(pan: Point, zoom: number, node: LabNode, viewport: { width: number; height: number }): Point {
  const left = pan.x + node.x * zoom;
  const top = pan.y + node.y * zoom;
  const right = left + node.width * zoom;
  const bottom = top + node.height * zoom;
  if (left >= 0 && top >= 0 && right <= viewport.width && bottom <= viewport.height) return pan;
  return {
    x: viewport.width / 2 - (node.x + node.width / 2) * zoom,
    y: viewport.height / 2 - (node.y + node.height / 2) * zoom,
  };
}



/**
 * The fixed panels that sit on the board but are neither a card nor an
 * outline. These values position the panels themselves, so anything choosing
 * a free spot can read the same board space bounds instead of the screen.
 */
export const BOARD_GUIDE_RECTS: { id: string; x: number; y: number; width: number; height: number }[] = [
  { id: "reasoning-trail", x: 60, y: 60, width: 896, height: 156 },
  { id: "start-here", x: 60, y: 228, width: 896, height: 180 },
];

/** The inline add control's own size, in board space. */
export const BOARD_INLINE_ADD_SIZE = { width: 220, height: 28 };

/** Where the inline add control sits: under the workstream row, clear of spilled cards. */
export function workstreamAddAnchor(frames: LabFrame[], nodes: LabNode[]): Point | null {

  const row = frames.filter((frame) => isWorkstreamFrameId(frame.id));
  if (row.length === 0) return null;
  const left = Math.min(...row.map((frame) => frame.x));
  const right = Math.max(...row.map((frame) => frame.x + frame.width));
  const bottoms = [
    ...row.map((frame) => frame.y + frame.height),
    ...nodes.filter((node) => node.x + node.width > left && node.x < right).map((node) => node.y + node.height),
  ];
  return { x: left, y: Math.max(...bottoms) + 24 };
}

/** Free space for a new workstream: under everything on the board, in the workstream column. */
export function nextWorkstreamRect(frames: LabFrame[], nodes: LabNode[]): LabRect {
  const workstreams = frames.filter((frame) => isWorkstreamFrameId(frame.id));
  const left = workstreams.length > 0 ? Math.min(...workstreams.map((frame) => frame.x)) : 60;
  const bottoms = [
    ...frames.map((frame) => frame.y + frame.height),
    ...nodes.map((node) => node.y + node.height),
  ];
  const bottom = bottoms.length > 0 ? Math.max(...bottoms) : 420;
  return { x: left, y: bottom + 48, width: FRAME_WIDTH, height: FRAME_HEIGHT };
}

export function addLocalFrame(frames: LabFrame[], name: string, rect?: LabRect): LabFrame[] {
  const index = frames.length;
  const placed = rect ?? {
    x: 60 + (index % FRAME_COLUMNS) * (FRAME_WIDTH + FRAME_GAP),
    y: 420 + Math.floor(index / FRAME_COLUMNS) * (FRAME_HEIGHT + FRAME_GAP),
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
  };
  return [
    ...frames,
    {
      id: `custom:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || `workstream-${index}`}`,
      name: name.trim(),
      ...placed,
      local: true,
    },
  ];
}

/**
 * A frame that has a durable row is no longer local, so the header must stop
 * saying so.
 */
export function markFrameSaved(frames: LabFrame[], localId: string, durableId: string, durableVersion: number): LabFrame[] {
  return frames.map((frame) => frame.id === localId ? { ...frame, durableId, durableVersion, local: false } : frame);
}

/** The board pans and zooms; the surface itself never scrolls. */
export function keepViewportUnscrolled(element: { scrollTop: number; scrollLeft: number }): void {
  if (element.scrollTop !== 0) element.scrollTop = 0;
  if (element.scrollLeft !== 0) element.scrollLeft = 0;
}

/**
 * The canvas size. With no outlines it is measured from the cards alone, and
 * a blank board still keeps a usable minimum so it can be panned and zoomed.
 */
export function stageBounds(frames: LabFrame[], nodes: LabNode[] = []): { width: number; height: number } {
  return {
    width: Math.max(980, ...frames.map((frame) => frame.x + frame.width + 60), ...nodes.map((node) => node.x + node.width + 120)),
    height: Math.max(720, ...frames.map((frame) => frame.y + frame.height + 120), ...nodes.map((node) => node.y + node.height + 160)),
  };
}

export type SeedInput = {
  brief: { title: string; text: string | null } | null;
  tasks: { id: string; name: string; detail: string | null; ownedByViewer: boolean }[];
  work: {
    id: string;
    title: string;
    typeLabel: string;
    source: string;
    ownedByViewer: boolean;
    taskIds: string[];
    deliverable: boolean;
  }[];
  decisions: { id: string; call: string; situation: string; ownedByViewer: boolean }[];
};

function stack(frame: LabFrame, index: number): Point {
  const columns = Math.max(1, Math.floor((frame.width - FRAME_PADDING * 2) / (CARD_WIDTH + 18)));
  const column = index % columns;
  const row = Math.floor(index / columns);
  return snapPoint({
    x: frame.x + FRAME_PADDING + column * (CARD_WIDTH + 18),
    y: frame.y + 60 + row * CARD_GAP_Y,
  });
}

/** Place a local draft in the next readable stack position in its frame. */
export function draftAnchor(frame: LabFrame, nodes: LabNode[]): Point {
  const rows = Math.max(1, Math.floor((frame.height - 60 - CARD_HEIGHT) / CARD_GAP_Y) + 1);
  const columns = Math.max(1, Math.floor((frame.width - FRAME_PADDING - CARD_WIDTH) / (CARD_WIDTH + 18)) + 1);
  const memberCount = nodes.filter((node) => node.frame === frame.id).length;
  const slot = Math.min(memberCount, rows * columns - 1);
  const column = Math.floor(slot / rows);
  const row = slot % rows;
  const candidate = snapPoint({
    x: frame.x + FRAME_PADDING + column * (CARD_WIDTH + 18),
    y: frame.y + 60 + row * CARD_GAP_Y,
  });
  return {
    x: Math.max(frame.x, Math.min(frame.x + frame.width - CARD_WIDTH, candidate.x)),
    y: Math.max(frame.y, Math.min(frame.y + frame.height - CARD_HEIGHT, candidate.y)),
  };
}

export function localNodeAnchor(frame: LabFrame, nodes: LabNode[], near?: Point): Point {
  const occupied = nodes.filter((node) => node.frame === frame.id);
  if (!near) return firstFreeLocalNodeAnchor(frame, nodes);
  const candidates = Array.from({ length: 12 }, (_, index) => snapPoint({
    x: Math.min(frame.x + frame.width - CARD_WIDTH - FRAME_PADDING, near.x + 40 + (index % 2) * 44),
    y: Math.min(frame.y + frame.height - 96, near.y + 60 + Math.floor(index / 2) * 44),
  }));
  return candidates.find((point) => occupied.every((node) => Math.abs(node.x - point.x) > 40 || Math.abs(node.y - point.y) > 40)) ?? stack(frame, occupied.length);
}

function cardRectsIntersect(point: Point, node: LabNode): boolean {
  return point.x < node.x + node.width && point.x + CARD_WIDTH > node.x && point.y < node.y + node.height && point.y + CARD_HEIGHT > node.y;
}

/** Choose the first stack slot clear of every visible card on the board. */
export function firstFreeLocalNodeAnchor(frame: LabFrame, visibleNodes: LabNode[]): Point {
  const columns = Math.max(1, Math.floor((frame.width - FRAME_PADDING * 2) / (CARD_WIDTH + 18)));
  const rows = Math.max(1, Math.floor((frame.height - 60 - FRAME_PADDING - CARD_HEIGHT) / CARD_GAP_Y) + 1);
  const candidateCount = columns * rows;
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = stack(frame, index);
    if (visibleNodes.every((node) => !cardRectsIntersect(candidate, node))) return candidate;
  }
  const members = visibleNodes.filter((node) => node.frame === frame.id);
  const bottom = members.length > 0 ? Math.max(...members.map((node) => node.y + node.height)) : frame.y + 60 - CARD_GAP_Y;
  return snapPoint({ x: frame.x + FRAME_PADDING, y: bottom + 32 });
}

let localCounter = 0;

/** Random per-card key. Session counters would collide across visits. */
export function newLabClientKey(): string {
  const source = globalThis.crypto;
  return `local:${source && "randomUUID" in source ? source.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function createLocalNode(kind: LabTemplateKind, frame: LabFrame, nodes: LabNode[], judgmentType?: LabJudgmentType): LabNode {
  localCounter += 1;
  const judgment = judgmentType ? JUDGMENT_TYPES.find((entry) => entry.value === judgmentType) : undefined;
  const label = judgment?.label ?? REASONING_STEPS.find((entry) => entry.kind === kind)?.label ?? "Local note";
  const at = localNodeAnchor(frame, nodes);
  return { id: `local-node:${localCounter}`, clientKey: newLabClientKey(), kind, frame: frame.id, title: label, summary: "Add a short note.", typeLabel: label, ownership: "draft", ...(judgmentType ? { judgmentType } : {}), local: true, x: at.x, y: at.y, width: CARD_WIDTH, height: CARD_HEIGHT };
}


export function updateLocalNode(nodes: LabNode[], id: string, text: string): LabNode[] {
  return nodes.map((node) => node.id === id && node.local ? { ...node, summary: text } : node);
}

export function deleteLocalNode(nodes: LabNode[], links: LabLink[], selected: string[], id: string) {
  const node = nodes.find((entry) => entry.id === id);
  if (!node?.local && node?.kind !== "chat") return { nodes, links, selected };
  return { nodes: nodes.filter((entry) => entry.id !== id), links: links.filter((link) => link.fromId !== id && link.toId !== id), selected: selected.filter((entry) => entry !== id) };
}

/** When a connection attempt ends (created or rejected), the source disarms and the board returns to idle. */
export function connectDisarmed(): { connectSource: null; interaction: "idle" } {
  return { connectSource: null, interaction: "idle" };
}

export function addLabLink(links: LabLink[], fromId: string, fromAnchor: LabAnchor, toId: string, toAnchor: LabAnchor): { links: LabLink[]; error: string | null } {
  if (fromId === toId) return { links, error: "A card cannot feed itself" };
  if (links.some((link) => link.fromId === fromId && link.toId === toId)) return { links, error: "Already connected" };
  return { links: [...links, { id: `local-link:${fromId}:${fromAnchor}:${toId}:${toAnchor}`, fromId, fromAnchor, toId, toAnchor }], error: null };
}

export function removeLabLink(links: LabLink[], id: string): LabLink[] {
  return links.filter((link) => link.id !== id);
}

export function linkRemovalAnnouncement(link: Pick<LabLink, "durableId">): string {
  return link.durableId ? "Relationship removed from the workboard." : "Local relationship removed.";
}

export function relationshipSelection(current: string | null, action: "select" | "deselect", id?: string): string | null {
  return action === "select" ? id ?? current : null;
}

export function labAnchorPoint(node: Pick<LabNode, "x" | "y" | "width">, side: LabAnchor, height: number): Point {
  if (side === "top") return { x: node.x + node.width / 2, y: node.y };
  if (side === "right") return { x: node.x + node.width, y: node.y + height / 2 };
  if (side === "bottom") return { x: node.x + node.width / 2, y: node.y + height };
  return { x: node.x, y: node.y + height / 2 };
}

export function nearestLabAnchor(point: Point, node: Pick<LabNode, "x" | "y" | "width">, height: number): LabAnchor {
  const sides: LabAnchor[] = ["top", "right", "bottom", "left"];
  const first = sides[0];
  if (!first) return "top";
  return sides.reduce((nearest, side) => {
    const candidate = labAnchorPoint(node, side, height);
    const current = labAnchorPoint(node, nearest, height);
    const candidateDistance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    const currentDistance = Math.hypot(point.x - current.x, point.y - current.y);
    return candidateDistance < currentDistance ? side : nearest;
  }, first);
}

export function labConnectorPath(from: Point, fromSide: LabAnchor, to: Point, toSide: LabAnchor): string {
  const offset = 64;
  const control = (point: Point, side: LabAnchor): Point => {
    if (side === "top") return { x: point.x, y: point.y - offset };
    if (side === "right") return { x: point.x + offset, y: point.y };
    if (side === "bottom") return { x: point.x, y: point.y + offset };
    return { x: point.x - offset, y: point.y };
  };
  const a = control(from, fromSide);
  const b = control(to, toSide);
  return `M ${from.x} ${from.y} C ${a.x} ${a.y}, ${b.x} ${b.y}, ${to.x} ${to.y}`;
}

function connectorControl(point: Point, side: LabAnchor): Point {
  if (side === "top") return { x: point.x, y: point.y - 64 };
  if (side === "right") return { x: point.x + 64, y: point.y };
  if (side === "bottom") return { x: point.x, y: point.y + 64 };
  return { x: point.x - 64, y: point.y };
}

function connectorPoint(from: Point, fromSide: LabAnchor, to: Point, toSide: LabAnchor, t: number): Point {
  const a = connectorControl(from, fromSide);
  const b = connectorControl(to, toSide);
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * from.x + 3 * inverse ** 2 * t * a.x + 3 * inverse * t ** 2 * b.x + t ** 3 * to.x,
    y: inverse ** 3 * from.y + 3 * inverse ** 2 * t * a.y + 3 * inverse * t ** 2 * b.y + t ** 3 * to.y,
  };
}

function connectorPointAtLength(from: Point, fromSide: LabAnchor, to: Point, toSide: LabAnchor, ratio: number): Point {
  const points = Array.from({ length: 101 }, (_, index) => connectorPoint(from, fromSide, to, toSide, index / 100));
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const wanted = lengths.reduce((sum, length) => sum + length, 0) * ratio;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] ?? 0;
    if (travelled + length >= wanted) {
      const start = points[index] ?? from;
      const end = points[index + 1] ?? to;
      const fraction = length > 0 ? (wanted - travelled) / length : 0;
      return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
    }
    travelled += length;
  }
  return to;
}

function centredBoxIntersects(point: Point, size: { width: number; height: number }, rect: LabRect): boolean {
  const left = point.x - size.width / 2;
  const top = point.y - size.height / 2;
  return left < rect.x + rect.width && left + size.width > rect.x && top < rect.y + rect.height && top + size.height > rect.y;
}

/** Keep a link label or picker clear of both cards, preferring the curve midpoint. */
export function labConnectorAffordancePoint(
  from: Point,
  fromSide: LabAnchor,
  to: Point,
  toSide: LabAnchor,
  size: { width: number; height: number },
  sourceRect: LabRect,
  targetRect: LabRect,
): Point {
  for (let percent = 50; percent >= 35; percent -= 1) {
    const point = connectorPointAtLength(from, fromSide, to, toSide, percent / 100);
    if (!centredBoxIntersects(point, size, sourceRect) && !centredBoxIntersects(point, size, targetRect)) return point;
  }
  return connectorPointAtLength(from, fromSide, to, toSide, 0.35);
}

/** Midpoint of the same cubic curve used for a relationship. */
export function labConnectorMidpoint(from: Point, fromSide: LabAnchor, to: Point, toSide: LabAnchor): Point {
  return connectorPoint(from, fromSide, to, toSide, 0.5);
}

/**
 * Local records that are explicitly related to one anchor. Review treats the
 * current unlabelled links as undirected and ignores links with missing ends.
 */
export function connectedLabNodeIds(nodes: LabNode[], links: LabLink[], anchorId: string): Set<string> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodeIds.has(anchorId)) return new Set();
  const neighbours = new Map<string, string[]>();
  for (const link of links) {
    if (!nodeIds.has(link.fromId) || !nodeIds.has(link.toId)) continue;
    neighbours.set(link.fromId, [...(neighbours.get(link.fromId) ?? []), link.toId]);
    neighbours.set(link.toId, [...(neighbours.get(link.toId) ?? []), link.fromId]);
  }
  const connected = new Set([anchorId]);
  const pending = [anchorId];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) continue;
    for (const neighbour of neighbours.get(current) ?? []) {
      if (connected.has(neighbour)) continue;
      connected.add(neighbour);
      pending.push(neighbour);
    }
  }
  return connected;
}

/**
 * The opening arrangement. Real content first, in the frame that explains it.
 * A frame with nothing in it still renders, so an absent kind reads as empty
 * rather than missing.
 */
export function seedCanvas(input: SeedInput, frames = createLabFrames(input.tasks)): LabNode[] {
  const nodes: LabNode[] = [];
  const frameById = (id: LabFrameId) =>
    frames.find((frame) => frame.id === id) ?? (frames[0] as LabFrame);
  const frameCounts = new Map<string, number>();
  const nextAt = (frameId: string) => {
    const index = frameCounts.get(frameId) ?? 0;
    frameCounts.set(frameId, index + 1);
    return stack(frameById(frameId), index);
  };

  if (input.brief) {
    const at = nextAt("foundation");
    nodes.push({
      id: "brief",
      kind: "brief",
      frame: "foundation",
      title: input.brief.title,
      summary: input.brief.text ?? "No brief written yet.",
      typeLabel: "brief",
      ownership: "yours",
      x: at.x,
      y: at.y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    });
  }

  for (const item of input.work) {
    const mappedTask = item.taskIds.find((taskId) => frames.some((frame) => frame.id === `task:${taskId}`));
    const frame: LabFrameId = item.deliverable
      ? "outputs"
      : mappedTask
        ? `task:${mappedTask}`
        : "foundation";
    const at = nextAt(frame);
    nodes.push({
      id: `work:${item.id}`,
      kind: "work",
      frame,
      title: item.title,
      summary: item.source,
      typeLabel: item.typeLabel,
      ownership: item.ownedByViewer ? "yours" : "teammate",
      workItemId: item.id,
      deliverable: item.deliverable,
      x: at.x,
      y: at.y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    });
  }

  input.decisions.forEach((decision, index) => {
    const at = nextAt("decisions");
    nodes.push({
      id: `decision:${decision.id}`,
      kind: "decision",
      frame: "decisions",
      title: decision.call,
      summary: decision.situation,
      typeLabel: "call",
      ownership: decision.ownedByViewer ? "yours" : "teammate",
      x: at.x,
      y: at.y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    });
  });

  return nodes;
}

/** A board carries seeded structure when it holds saved workstream outlines. */
export function boardHasSeededStructure(board: { frames: { kind?: string | null; key?: string | null; label?: string | null }[] } | null | undefined): boolean {
  // The context region and a trail a person added are both made on demand on a
  // blank board, so neither is seeded structure and neither brings the guide
  // panels back.
  return (board?.frames ?? []).some((frame) => frame.kind !== "context" && !isTrailFrameId(frame.key) && !(isRegionFrameId(frame.key) && !frame.label?.trim()));
}

/**
 * The opening arrangement on a blank board. No outlines exist, so position is
 * the only thing placing a card: a packed flow from the origin, on the grid,
 * with the same clear space the rest of the board keeps.
 */
export function seedBlankCanvas(input: SeedInput): LabNode[] {
  const entries: Omit<LabNode, "x" | "y" | "width" | "height">[] = [];
  if (input.brief) {
    entries.push({
      id: "brief",
      kind: "brief",
      frame: null,
      title: input.brief.title,
      summary: input.brief.text ?? "No brief written yet.",
      typeLabel: "brief",
      ownership: "yours",
    });
  }
  for (const item of input.work) {
    entries.push({
      id: `work:${item.id}`,
      kind: "work",
      frame: null,
      title: item.title,
      summary: item.source,
      typeLabel: item.typeLabel,
      ownership: item.ownedByViewer ? "yours" : "teammate",
      workItemId: item.id,
      deliverable: item.deliverable,
    });
  }
  for (const decision of input.decisions) {
    entries.push({
      id: `decision:${decision.id}`,
      kind: "decision",
      frame: null,
      title: decision.call,
      summary: decision.situation,
      typeLabel: "call",
      ownership: decision.ownedByViewer ? "yours" : "teammate",
    });
  }
  const points = placeAddedCards({ x: 0, y: 0 }, [], entries.length);
  return entries.map((entry, index) => {
    const at = points[index] ?? { x: 0, y: 0 };
    return { ...entry, x: at.x, y: at.y, width: CARD_WIDTH, height: CARD_HEIGHT };
  });
}

/** Move one node. Positions snap to the grid, exactly like the board does. */
export function moveNode(nodes: LabNode[], id: string, to: Point): LabNode[] {
  const at = snapPoint(to);
  return nodes.map((node) => (node.id === id ? { ...node, x: at.x, y: at.y } : node));
}

export function toggleContext(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}

export function removeContext(selected: string[], id: string): string[] {
  return selected.filter((value) => value !== id);
}

let chatCounter = 0;

/** Test helper: the lab's own counter, reset between cases. */
export function resetChatCounter(): void {
  chatCounter = 0;
}

/**
 * A chat card is a local draft and says so. It never claims an answer came
 * back, because in this prototype nothing was asked of any model.
 */
export function createChatNode(
  prompt: string,
  contextIds: string[],
  anchor: Point = { x: 1040, y: 640 },
  frame: LabFrameId = "outputs",
): LabNode {
  chatCounter += 1;
  const at = snapPoint({ x: anchor.x, y: anchor.y + (chatCounter - 1) * 40 });
  return {
    id: `chat:${chatCounter}`,
    kind: "chat",
    frame,
    title: prompt.length > 64 ? `${prompt.slice(0, 61)}...` : prompt,
    summary: "Local draft. The live AI connection is off in this prototype.",
    typeLabel: "draft chat",
    ownership: "draft",
    prompt,
    contextIds: [...contextIds],
    local: true,
    x: at.x,
    y: at.y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
}

/**
 * Branching copies the context into a fresh draft. The card it came from is
 * left exactly as it was, and no source work is touched.
 */
export function branchChatNode(node: LabNode): LabNode {
  const branch = createChatNode(node.prompt ?? node.title, node.contextIds ?? [], {
    x: node.x + 260,
    y: node.y + 60,
  }, node.frame ?? undefined);
  return { ...branch, title: `Branch of ${node.title}`, x: branch.x, y: branch.y };
}

/** What a person may do with a thing, by who owns it. */
export function actionsFor(ownership: LabOwnership): string[] {
  if (ownership === "yours") return ["Arrange", "Open"];
  if (ownership === "draft") return ["Edit here", "Branch", "Focus"];
  return ["Read", "Summarize", "Branch", "Comment"];
}

export type LabComment = {
  id: string;
  nodeId: string;
  quote: string;
  body: string;
  author: string;
  at: string;
};

let commentCounter = 0;

export function resetCommentCounter(): void {
  commentCounter = 0;
}

export function createComment(
  nodeId: string,
  quote: string,
  body: string,
  author: string,
): LabComment {
  commentCounter += 1;
  return {
    id: `comment:${commentCounter}`,
    nodeId,
    quote: quote.length > 160 ? `${quote.slice(0, 157)}...` : quote,
    body,
    author,
    at: "just now",
  };
}

/** Fit the whole stage inside the viewport, with a little air around it. */
export function fitScale(
  viewportWidth: number,
  viewportHeight: number,
  stage: { width: number; height: number } = { width: 1460, height: 1240 },
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 1;
  const scale = Math.min(viewportWidth / (stage.width + 80), viewportHeight / (stage.height + 80));
  return Math.max(0.62, Math.min(1.6, scale));
}

export type LabRect = { x: number; y: number; width: number; height: number };

export type LabFitResult = { zoom: number; pan: Point; bounds: LabRect };

export type LabViewportSize = { width: number; height: number };

export function viewportSizeChanged(previous: LabViewportSize | null, next: LabViewportSize): boolean {
  return previous === null || previous.width !== next.width || previous.height !== next.height;
}

/**
 * Fit the visible workboard union into its shell. Measured card heights are
 * accepted separately because paper can extend beyond its stored rectangle.
 */
export function fitWorkboardViewport(
  viewport: { width: number; height: number },
  frames: Pick<LabFrame, "x" | "y" | "width" | "height">[],
  nodes: (Pick<LabNode, "id" | "x" | "y" | "width" | "height">)[],
  measuredHeights: ReadonlyMap<string, number>,
  guides: LabRect | null = { x: 60, y: 60, width: 896, height: 300 },
  padding = 32,
): LabFitResult {
  const rects: LabRect[] = [
    ...(guides ? [guides] : []),
    ...frames,
    ...nodes.map((node) => ({
      x: node.x,
      y: node.y,
      width: node.width,
      height: Math.max(node.height, measuredHeights.get(node.id) ?? 0),
    })),
  ];
  // Nothing on the board yet: keep a usable canvas rather than collapsing.
  const bounds = rects.length === 0
    ? { x: 0, y: 0, width: 980, height: 720 }
    : (() => {
      const left = Math.min(...rects.map((rect) => rect.x));
      const top = Math.min(...rects.map((rect) => rect.y));
      const right = Math.max(...rects.map((rect) => rect.x + rect.width));
      const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
      return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    })();
  const availableWidth = Math.max(0, viewport.width - padding * 2);
  const availableHeight = Math.max(0, viewport.height - padding * 2);
  const zoom = clampZoom(Math.min(1, availableWidth / bounds.width, availableHeight / bounds.height));
  const fitsWidth = bounds.width * zoom <= availableWidth;
  const fitsHeight = bounds.height * zoom <= availableHeight;
  return {
    zoom,
    pan: {
      x: fitsWidth ? (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom : padding - bounds.x * zoom,
      y: fitsHeight ? (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom : padding - bounds.y * zoom,
    },
    bounds,
  };
}

export type LabResizeKind = "card" | "frame" | "shape" | "text" | "sticky";

export function resizeLabRect(start: LabRect, corner: LabResizeCorner, delta: Point, preserveAspect = false, kind: LabResizeKind = "card"): LabRect {
  const minWidth = kind === "sticky" ? WORKBOARD_STICKY_MIN_WIDTH : kind === "shape" ? WORKBOARD_SHAPE_MIN_SIZE : kind === "text" ? WORKBOARD_TEXT_MIN_WIDTH : kind === "card" ? CARD_MIN_WIDTH : FRAME_MIN_WIDTH;
  const minHeight = kind === "sticky" ? WORKBOARD_STICKY_MIN_HEIGHT : kind === "shape" ? WORKBOARD_SHAPE_MIN_SIZE : kind === "text" ? WORKBOARD_TEXT_MIN_HEIGHT : kind === "card" ? CARD_MIN_HEIGHT : FRAME_MIN_HEIGHT;
  const maxWidth = kind === "sticky" ? WORKBOARD_STICKY_MAX_SIZE : kind === "shape" ? WORKBOARD_SHAPE_MAX_SIZE : kind === "text" ? WORKBOARD_TEXT_MAX_SIZE : kind === "card" ? CARD_MAX_WIDTH : 2400;
  const maxHeight = kind === "sticky" ? WORKBOARD_STICKY_MAX_SIZE : kind === "shape" ? WORKBOARD_SHAPE_MAX_SIZE : kind === "text" ? WORKBOARD_TEXT_MAX_SIZE : kind === "card" ? CARD_MAX_HEIGHT : 1800;
  const left = corner === "nw" || corner === "sw";
  const top = corner === "nw" || corner === "ne";
  let width = Math.max(minWidth, Math.min(maxWidth, start.width + (left ? -delta.x : delta.x)));
  let height = Math.max(minHeight, Math.min(maxHeight, start.height + (top ? -delta.y : delta.y)));
  if (preserveAspect) {
    const ratio = start.width / start.height;
    if (Math.abs(width - start.width) >= Math.abs(height - start.height) * ratio) height = Math.max(minHeight, Math.min(maxHeight, width / ratio));
    else width = Math.max(minWidth, Math.min(maxWidth, height * ratio));
  }
  return {
    x: left ? start.x + start.width - width : start.x,
    y: top ? start.y + start.height - height : start.y,
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function cardSizeTier(node: Pick<LabNode, "width" | "height">): "compact" | "standard" | "expanded" {
  if (node.width < 220 || node.height < 136) return "compact";
  if (node.width >= 320 || node.height >= 220) return "expanded";
  return "standard";
}

export function fitFrameToNodes(frame: LabFrame, nodes: LabNode[]): LabRect | null {
  const members = nodes.filter((node) => node.frame === frame.id);
  if (members.length === 0) return null;
  const left = Math.min(...members.map((node) => node.x)) - FRAME_PADDING;
  const top = Math.min(...members.map((node) => node.y)) - 60;
  const right = Math.max(...members.map((node) => node.x + node.width)) + FRAME_PADDING;
  const bottom = Math.max(...members.map((node) => node.y + node.height)) + FRAME_PADDING;
  return { x: left, y: top, width: Math.max(FRAME_MIN_WIDTH, right - left), height: Math.max(FRAME_MIN_HEIGHT, bottom - top) };
}

export function containFrameMembers(rect: LabRect, frameId: string, nodes: LabNode[]): LabRect {
  const members = nodes.filter((node) => node.frame === frameId);
  if (members.length === 0) return rect;
  const contentLeft = Math.min(...members.map((node) => node.x)) - FRAME_PADDING;
  const contentTop = Math.min(...members.map((node) => node.y)) - 60;
  const contentRight = Math.max(...members.map((node) => node.x + node.width)) + FRAME_PADDING;
  const contentBottom = Math.max(...members.map((node) => node.y + node.height)) + FRAME_PADDING;
  const x = Math.min(rect.x, contentLeft);
  const y = Math.min(rect.y, contentTop);
  // F1: never hand back a size the record would refuse.
  return {
    x,
    y,
    width: Math.max(FRAME_MIN_WIDTH, Math.max(rect.x + rect.width, contentRight) - x),
    height: Math.max(FRAME_MIN_HEIGHT, Math.max(rect.y + rect.height, contentBottom) - y),
  };
}

/* ------------------------------------------------------------------ */
/* Phase 3 Slice 1: durable Workboard merge and review traversal       */
/* ------------------------------------------------------------------ */

/** Virtual id a durable reference card maps to in the local model. */
export function durableLocalId(node: Pick<WorkboardNodeDto, "kind" | "workItemId" | "decisionId" | "id">): string {
  if (node.kind === "work_item" && node.workItemId) return `work:${node.workItemId}`;
  if (node.kind === "decision" && node.decisionId) return `decision:${node.decisionId}`;
  if (node.kind === "brief") return "brief";
  return `durable:${node.id}`;
}

export type DurableMerge = { frames: LabFrame[]; nodes: LabNode[]; links: LabLink[]; hiddenIds: string[] };

/**
 * Overlay a loaded durable board onto the deterministic virtual seed. The
 * seed supplies display data from canonical records; durable rows supply
 * placement, hidden state, authored judgments, custom frames, and explicit
 * relationships. Durable references whose source left the engagement simply
 * vanish; new canonical work without a durable row keeps its virtual spot.
 */
export function applyDurableBoard(base: { frames: LabFrame[]; nodes: LabNode[] }, board: WorkboardDto): DurableMerge {
  const frames: LabFrame[] = [];
  const frameIdByKey = new Map<string, string>();
  const orderedDurableFrames = [...board.frames].sort((a, b) => a.ord - b.ord);
  for (const baseFrame of base.frames) {
    const durable = orderedDurableFrames.find((frame) => frame.key === baseFrame.id);
    if (!durable) {
      frames.push(baseFrame);
      continue;
    }
    frameIdByKey.set(durable.id, baseFrame.id);
    frames.push({ ...baseFrame, x: durable.x, y: durable.y, width: durable.w, height: durable.h, fill: durable.fill ?? null, durableId: durable.id, durableVersion: durable.version });
  }
  for (const durable of orderedDurableFrames) {
    if (base.frames.some((frame) => frame.id === durable.key)) continue;
    // The trail keeps its own key so a reloaded board still knows the panel is
    // a trail rather than an unnamed outline.
    // F1: the context region keeps its own key too. Without this a reloaded
    // board forgot the region was context, made a second local one with no
    // durable row behind it, and every resize on it went nowhere.
    const id = durable.key.startsWith("custom:") || isRegionFrameId(durable.key) || isTrailFrameId(durable.key) || isContextFrameId(durable.key) ? durable.key : `durable-frame:${durable.id}`;
    frameIdByKey.set(durable.id, id);
    // W3: a drawn region with no name is paint, so it keeps its empty name.
    frames.push({ id, name: durable.label ?? (isRegionFrameId(id) ? "" : "Workstream"), fill: durable.fill ?? null, x: durable.x, y: durable.y, width: durable.w, height: durable.h, durableId: durable.id, durableVersion: durable.version });
  }

  const nodes: LabNode[] = [];
  const localIdByDurable = new Map<string, string>();
  const matchedVirtual = new Set<string>();
  for (const durable of board.nodes) {
    const localId = durableLocalId(durable);
    localIdByDurable.set(durable.id, localId);
    const frameId = durable.frameId ? frameIdByKey.get(durable.frameId) ?? null : null;
    const virtualIndex = base.nodes.findIndex((node) => node.id === localId);
    if (virtualIndex >= 0) {
      const virtual = base.nodes[virtualIndex] as LabNode;
      matchedVirtual.add(virtual.id);
      nodes.push({
        ...virtual,
        frame: frameId ?? virtual.frame ?? null,
        x: durable.x,
        y: durable.y,
        width: durable.w > 0 ? durable.w : CARD_WIDTH,
        height: durable.h > 0 ? durable.h : CARD_HEIGHT,
        durableId: durable.id,
        durableVersion: durable.version,
        linkedItemRemovedAt: durable.linkedItemRemovedAt ?? null,
      });
      continue;
    }
    if (durable.kind === "judgment") {
      const judgment = JUDGMENT_TYPES.find((entry) => entry.value === durable.judgmentType);
      nodes.push({
        id: localId,
        kind: "judgment",
        frame: frameId ?? (base.frames.length > 0 ? "foundation" : null),
        title: durable.title || judgment?.label || "Human judgment",
        summary: durable.body,
        typeLabel: judgment?.label ?? "Human judgment",
        ownership: durable.authorProfileId === board.viewerProfileId ? "draft" : "teammate",
        ...(durable.judgmentType ? { judgmentType: durable.judgmentType as LabJudgmentType } : {}),
        local: durable.authorProfileId === board.viewerProfileId,
        durableId: durable.id,
        durableVersion: durable.version,
        linkedItemRemovedAt: durable.linkedItemRemovedAt ?? null,
        x: durable.x,
        y: durable.y,
        width: durable.w > 0 ? durable.w : CARD_WIDTH,
        height: durable.h > 0 ? durable.h : CARD_HEIGHT,
      });
    }
    if (durable.kind === "shape") {
      nodes.push({
        id: localId,
        kind: "shape",
        frame: null,
        title: "Colour block",
        summary: "",
        typeLabel: "colour block",
        ownership: durable.authorProfileId === board.viewerProfileId ? "yours" : "teammate",
        colour: durable.body as WorkboardShapeColour,
        local: false,
        durableId: durable.id,
        durableVersion: durable.version,
        x: durable.x,
        y: durable.y,
        width: durable.w,
        height: durable.h,
      });
    }
    if (durable.kind === "sticky") {
      const sticky = parseWorkboardStickyBody(durable.body);
      if (sticky) nodes.push({
        id: localId,
        kind: "sticky",
        frame: null,
        title: "Sticky",
        summary: sticky.text,
        typeLabel: "sticky",
        ownership: durable.authorProfileId === board.viewerProfileId ? "yours" : "teammate",
        textSize: sticky.size,
        textWeight: sticky.weight,
        textColour: sticky.colour,
        stickyFill: sticky.fill,
        local: durable.authorProfileId === board.viewerProfileId,
        durableId: durable.id,
        durableVersion: durable.version,
        x: durable.x,
        y: durable.y,
        width: durable.w,
        height: durable.h,
      });
    }
    if (durable.kind === "text") {
      const text = parseWorkboardTextBody(durable.body);
      if (text) nodes.push({
        id: localId,
        kind: "text",
        frame: null,
        title: "Text block",
        summary: text.text,
        typeLabel: "text block",
        ownership: durable.authorProfileId === board.viewerProfileId ? "yours" : "teammate",
        textSize: text.size,
        textWeight: text.weight,
        textColour: text.colour,
        local: durable.authorProfileId === board.viewerProfileId,
        durableId: durable.id,
        durableVersion: durable.version,
        x: durable.x,
        y: durable.y,
        width: durable.w,
        height: durable.h,
      });
    }
    if (durable.kind === "answer") {
      nodes.push({
        id: localId,
        kind: "answer",
        frame: frameId,
        title: durable.title || "Answer",
        summary: durable.body,
        typeLabel: "answer",
        ownership: durable.authorProfileId === board.viewerProfileId ? "yours" : "teammate",
        authorName: durable.authorName,
        createdAt: durable.createdAt ?? null,
        local: durable.authorProfileId === board.viewerProfileId,
        durableId: durable.id,
        durableVersion: durable.version,
        x: durable.x,
        y: durable.y,
        width: durable.w > 0 ? durable.w : CARD_WIDTH,
        height: durable.h > 0 ? durable.h : CARD_HEIGHT,
      });
    }
    // draft rows are deliberately not rehydrated in Slice 1.
  }
  for (const virtual of base.nodes) if (!matchedVirtual.has(virtual.id)) nodes.push(virtual);

  const decorationIds = new Set(board.nodes.filter((node) => isWorkboardDecorationKind(node.kind)).map((node) => node.id));
  const links: LabLink[] = board.links.flatMap((link) => {
    if (decorationIds.has(link.fromNodeId) || decorationIds.has(link.toNodeId)) return [];
    const fromId = localIdByDurable.get(link.fromNodeId);
    const toId = localIdByDurable.get(link.toNodeId);
    if (!fromId || !toId) return [];
    return [{ id: `durable-link:${link.id}`, fromId, toId, fromAnchor: link.fromAnchor, toAnchor: link.toAnchor, durableId: link.id, durableVersion: link.version, relation: link.relation }];
  });

  const hiddenIds = board.nodes.filter((node) => node.hidden).map((node) => durableLocalId(node));
  return { frames, nodes, links, hiddenIds };
}

/**
 * What fed this: walk only explicit inbound relationships from the reviewed
 * node, with cycle protection and a depth bound. Proximity, shared frames,
 * and node kinds contribute nothing.
 */
export function inboundLabNodeIds(nodes: LabNode[], links: LabLink[], anchorId: string, maxDepth = 8): Set<string> {
  const nodeIds = new Set(nodes.filter((node) => !isWorkboardDecorationKind(node.kind)).map((node) => node.id));
  if (!nodeIds.has(anchorId)) return new Set();
  const inbound = new Map<string, string[]>();
  for (const link of links) {
    if (!nodeIds.has(link.fromId) || !nodeIds.has(link.toId)) continue;
    inbound.set(link.toId, [...(inbound.get(link.toId) ?? []), link.fromId]);
  }
  const reached = new Set([anchorId]);
  let frontier = [anchorId];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const source of inbound.get(current) ?? []) {
        if (reached.has(source)) continue;
        reached.add(source);
        next.push(source);
      }
    }
    frontier = next;
  }
  return reached;
}

export type DecorationPointerIntent = "pan" | "drag";

/** An unselected block yields its middle to the board and is picked up at an edge. */
export function decorationPointerIntent(input: { selected: boolean; onEdge: boolean }): DecorationPointerIntent {
  return input.selected || input.onEdge ? "drag" : "pan";
}

/** Cards recently pressed or focused render above the rest, newest last. */
export const LAB_FRONT_LIMIT = 12;

export function bringToFront(front: string[], id: string): string[] {
  return [...front.filter((entry) => entry !== id), id].slice(-LAB_FRONT_LIMIT);
}

/** The stacking order for one card, kept below the stage's own overlays. */
export function cardStackZ(front: string[], id: string): number {
  const index = front.indexOf(id);
  return index === -1 ? 1 : 2 + index;
}

/** The closed event vocabulary for one card. A deliverable says so. */
export function eventKind(node: LabNode): LabNodeEventKind {
  if (node.kind === "answer") return "answer";
  if (node.kind === "shape") return "shape";
  if (node.kind === "text") return "text";
  if (node.kind === "sticky") return "sticky";
  if (node.kind === "chat") return "draft_thread";
  if (node.kind === "judgment") return "human_judgment";
  if (node.kind === "ai_work") return "ai_work";
  if (node.kind === "deliverable") return "deliverable";
  if (node.kind === "decision") return "decision";
  if (node.kind === "work" && node.deliverable) return "deliverable";
  return "source";
}

/** A retried change reports the action it always was, not a blanket update. */
export function retryAction(command: WorkboardCommand): "create" | "update" | "archive" | "restore" {
  if (command.type === "node_create" || command.type === "frame_create" || command.type === "link_create") return "create";
  if (command.type.endsWith("_archive")) return "archive";
  if (command.type.endsWith("_restore")) return "restore";
  return "update";
}

/* ---------------- U2: chat bundles, derived, never stored ---------------- */

/** The work item fields a bundle is read from. Nothing here is written back. */
export type BundleItem = {
  id: string;
  type: string;
  owner_id?: string | null | undefined;
  orig_conversation_id?: string | null | undefined;
  ungrouped_at?: string | null | undefined;
  captured_at?: string | null | undefined;
  created_at_source?: string | null | undefined;
  source_meta?: { role?: string | null; produced_at_turn?: number | null } | null | undefined;
};

/** Chat node id to its ordered piece node ids. */
export type ChatBundles = ReadonlyMap<string, readonly string[]>;

function bundleKey(item: BundleItem): string | null {
  if (!item.owner_id || !item.orig_conversation_id || item.ungrouped_at) return null;
  return `${item.owner_id}\u0000${item.orig_conversation_id}`;
}

function pieceTurn(item: BundleItem): number | null {
  const turn = item.source_meta?.produced_at_turn;
  return typeof turn === "number" && Number.isFinite(turn) ? turn : null;
}

function pieceCreated(item: BundleItem): string {
  return item.created_at_source ?? item.captured_at ?? "";
}

/**
 * A pushed chat and the pieces it made, when both sit visible on this board.
 * Same owner, same conversation, chat is ai_thread, piece is an attachment,
 * neither ungrouped. A piece belongs to at most one chat.
 */
export function chatBundles(
  nodes: readonly Pick<LabNode, "id" | "workItemId">[],
  items: readonly BundleItem[],
  hiddenIds: readonly string[] = [],
): Map<string, string[]> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const chats = new Map<string, string>();
  const pieces: { nodeId: string; key: string; item: BundleItem }[] = [];
  for (const node of nodes) {
    if (!node.workItemId || hiddenIds.includes(node.id)) continue;
    const item = byId.get(node.workItemId);
    if (!item) continue;
    const key = bundleKey(item);
    if (!key) continue;
    if (item.type === "ai_thread") {
      if (!chats.has(key)) chats.set(key, node.id);
    } else if (item.source_meta?.role === "attachment") {
      pieces.push({ nodeId: node.id, key, item });
    }
  }
  const grouped = new Map<string, typeof pieces>();
  const claimed = new Set<string>();
  for (const piece of pieces) {
    const chatId = chats.get(piece.key);
    if (!chatId || claimed.has(piece.nodeId)) continue;
    claimed.add(piece.nodeId);
    grouped.set(chatId, [...(grouped.get(chatId) ?? []), piece]);
  }
  const result = new Map<string, string[]>();
  for (const [chatId, list] of grouped) {
    const ordered = [...list].sort((a, b) => {
      const ta = pieceTurn(a.item);
      const tb = pieceTurn(b.item);
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
      if (ta !== null && tb === null) return -1;
      if (ta === null && tb !== null) return 1;
      return pieceCreated(a.item).localeCompare(pieceCreated(b.item));
    });
    result.set(chatId, ordered.map((piece) => piece.nodeId));
  }
  return result;
}

/** Piece node id to the chat node id it is docked under. */
export function dockedPieceChats(bundles: ChatBundles): Map<string, string> {
  const map = new Map<string, string>();
  for (const [chatId, pieceIds] of bundles) for (const pieceId of pieceIds) map.set(pieceId, chatId);
  return map;
}

export const BUNDLE_GAP = 18;
export const BUNDLE_INDENT = 24;

/**
 * Places each piece in a column below its chat: indented 24px, 18px between
 * cards. Heights are the card's rendered box. Stored piece x and y are ignored.
 */
export function dockBundles<T extends Pick<LabNode, "id" | "x" | "y" | "height">>(nodes: readonly T[], bundles: ChatBundles): T[] {
  if (bundles.size === 0) return nodes as T[];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const placed = new Map<string, { x: number; y: number }>();
  for (const [chatId, pieceIds] of bundles) {
    const chat = byId.get(chatId);
    if (!chat) continue;
    let top = chat.y + chat.height + BUNDLE_GAP;
    for (const pieceId of pieceIds) {
      const piece = byId.get(pieceId);
      if (!piece) continue;
      placed.set(pieceId, { x: chat.x + BUNDLE_INDENT, y: top });
      top += piece.height + BUNDLE_GAP;
    }
  }
  return nodes.map((node) => {
    const at = placed.get(node.id);
    return at ? { ...node, ...at } : node;
  });
}

/** The size of the bundle count sent when the board opens. */
export function bundleCountBand(count: number): "0" | "1" | "2_plus" {
  return count <= 0 ? "0" : count === 1 ? "1" : "2_plus";
}
