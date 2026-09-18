/**
 * Canvas Lab, as pure state.
 *
 * No React, no DOM, no database. Every move the lab makes resolves through
 * here, so the pointer path, the keyboard path and the composer cannot drift
 * apart. Nothing in this module is persisted: the lab is a prototype and its
 * whole state lives in memory for one visit.
 */

import { snapPoint, type Point } from "@/lib/canvas-drag";
import type { WorkboardDto, WorkboardNodeDto, WorkboardRelation } from "@/lib/canvas-lab-shared";

export type LabNodeKind = "brief" | "task" | "work" | "decision" | "chat" | "source" | "ai_work" | "judgment" | "deliverable";
export type LabJudgmentType = "added_constraint" | "corrected_ai" | "rejected_option" | "requested_evidence" | "changed_direction" | "accepted_but_rewrote";
export type LabTemplateKind = "source" | "ai_work" | "judgment" | "decision" | "deliverable";

/** Who the thing belongs to, which is what decides the offered actions. */
export type LabOwnership = "yours" | "teammate" | "draft";

export type LabFrameId = string;
export type LabAnchor = "top" | "right" | "bottom" | "left";

export type LabNode = {
  id: string;
  kind: LabNodeKind;
  frame: LabFrameId;
  title: string;
  /** One quiet line under the title in Cards, the preview header in Live. */
  summary: string;
  /** Short type word shown in the card's micro label. */
  typeLabel: string;
  ownership: LabOwnership;
  /** Present only when the card stands for a real work element. */
  workItemId?: string | undefined;
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

  x: number;
  y: number;
};

export type LabFrame = {
  id: LabFrameId;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  local?: boolean;
  durableId?: string;
  durableVersion?: number;
};

export const CARD_WIDTH = 232;
export const CARD_GAP_Y = 144;
export const FRAME_PADDING = 24;

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

export function addLocalFrame(frames: LabFrame[], name: string): LabFrame[] {
  const index = frames.length;
  return [
    ...frames,
    {
      id: `custom:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || `workstream-${index}`}`,
      name: name.trim(),
      x: 60 + (index % FRAME_COLUMNS) * (FRAME_WIDTH + FRAME_GAP),
      y: 420 + Math.floor(index / FRAME_COLUMNS) * (FRAME_HEIGHT + FRAME_GAP),
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      local: true,
    },
  ];
}

export function stageBounds(frames: LabFrame[]): { width: number; height: number } {
  return {
    width: Math.max(980, ...frames.map((frame) => frame.x + frame.width + 60)),
    height: Math.max(720, ...frames.map((frame) => frame.y + frame.height + 120)),
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
  return stack(frame, nodes.filter((node) => node.frame === frame.id).length);
}

export function localNodeAnchor(frame: LabFrame, nodes: LabNode[], near?: Point): Point {
  const occupied = nodes.filter((node) => node.frame === frame.id);
  if (!near) return stack(frame, occupied.length);
  const candidates = Array.from({ length: 12 }, (_, index) => snapPoint({
    x: Math.min(frame.x + frame.width - CARD_WIDTH - FRAME_PADDING, near.x + 40 + (index % 2) * 44),
    y: Math.min(frame.y + frame.height - 96, near.y + 60 + Math.floor(index / 2) * 44),
  }));
  return candidates.find((point) => occupied.every((node) => Math.abs(node.x - point.x) > 40 || Math.abs(node.y - point.y) > 40)) ?? stack(frame, occupied.length);
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
  return { id: `local-node:${localCounter}`, clientKey: newLabClientKey(), kind, frame: frame.id, title: label, summary: "Add a short note.", typeLabel: label, ownership: "draft", ...(judgmentType ? { judgmentType } : {}), local: true, x: at.x, y: at.y };
}


export function updateLocalNode(nodes: LabNode[], id: string, text: string): LabNode[] {
  return nodes.map((node) => node.id === id && node.local ? { ...node, summary: text } : node);
}

export function deleteLocalNode(nodes: LabNode[], links: LabLink[], selected: string[], id: string) {
  const node = nodes.find((entry) => entry.id === id);
  if (!node?.local && node?.kind !== "chat") return { nodes, links, selected };
  return { nodes: nodes.filter((entry) => entry.id !== id), links: links.filter((link) => link.fromId !== id && link.toId !== id), selected: selected.filter((entry) => entry !== id) };
}

export function addLabLink(links: LabLink[], fromId: string, fromAnchor: LabAnchor, toId: string, toAnchor: LabAnchor): { links: LabLink[]; error: string | null } {
  if (fromId === toId) return { links, error: "A card cannot connect to itself." };
  if (links.some((link) => link.fromId === fromId && link.fromAnchor === fromAnchor && link.toId === toId && link.toAnchor === toAnchor)) return { links, error: "These cards are already connected." };
  return { links: [...links, { id: `local-link:${fromId}:${fromAnchor}:${toId}:${toAnchor}`, fromId, fromAnchor, toId, toAnchor }], error: null };
}

export function removeLabLink(links: LabLink[], id: string): LabLink[] {
  return links.filter((link) => link.id !== id);
}

export function labAnchorPoint(node: Pick<LabNode, "x" | "y">, side: LabAnchor, height: number): Point {
  if (side === "top") return { x: node.x + CARD_WIDTH / 2, y: node.y };
  if (side === "right") return { x: node.x + CARD_WIDTH, y: node.y + height / 2 };
  if (side === "bottom") return { x: node.x + CARD_WIDTH / 2, y: node.y + height };
  return { x: node.x, y: node.y + height / 2 };
}

export function nearestLabAnchor(point: Point, node: Pick<LabNode, "x" | "y">, height: number): LabAnchor {
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
      x: at.x,
      y: at.y,
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
    });
  });

  return nodes;
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
  }, node.frame);
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
    frames.push({ ...baseFrame, x: durable.x, y: durable.y, width: durable.w, height: durable.h, durableId: durable.id, durableVersion: durable.version });
  }
  for (const durable of orderedDurableFrames) {
    if (base.frames.some((frame) => frame.id === durable.key)) continue;
    const id = durable.key.startsWith("custom:") ? durable.key : `durable-frame:${durable.id}`;
    frameIdByKey.set(durable.id, id);
    frames.push({ id, name: durable.label ?? "Workstream", x: durable.x, y: durable.y, width: durable.w, height: durable.h, durableId: durable.id, durableVersion: durable.version });
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
        frame: frameId ?? virtual.frame,
        x: durable.x,
        y: durable.y,
        durableId: durable.id,
        durableVersion: durable.version,
      });
      continue;
    }
    if (durable.kind === "judgment") {
      const judgment = JUDGMENT_TYPES.find((entry) => entry.value === durable.judgmentType);
      nodes.push({
        id: localId,
        kind: "judgment",
        frame: frameId ?? "foundation",
        title: durable.title || judgment?.label || "Human judgment",
        summary: durable.body,
        typeLabel: judgment?.label ?? "Human judgment",
        ownership: durable.authorProfileId === board.viewerProfileId ? "draft" : "teammate",
        ...(durable.judgmentType ? { judgmentType: durable.judgmentType as LabJudgmentType } : {}),
        local: durable.authorProfileId === board.viewerProfileId,
        durableId: durable.id,
        durableVersion: durable.version,
        x: durable.x,
        y: durable.y,
      });
    }
    // draft rows are deliberately not rehydrated in Slice 1.
  }
  for (const virtual of base.nodes) if (!matchedVirtual.has(virtual.id)) nodes.push(virtual);

  const links: LabLink[] = board.links.flatMap((link) => {
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
  const nodeIds = new Set(nodes.map((node) => node.id));
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
