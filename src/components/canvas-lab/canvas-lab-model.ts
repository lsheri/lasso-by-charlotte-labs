/**
 * Canvas Lab, as pure state.
 *
 * No React, no DOM, no database. Every move the lab makes resolves through
 * here, so the pointer path, the keyboard path and the composer cannot drift
 * apart. Nothing in this module is persisted: the lab is a prototype and its
 * whole state lives in memory for one visit.
 */

import { snapPoint, type Point } from "@/lib/canvas-drag";

export type LabNodeKind = "brief" | "task" | "work" | "decision" | "chat";

/** Who the thing belongs to, which is what decides the offered actions. */
export type LabOwnership = "yours" | "teammate" | "draft";

export type LabFrameId = string;

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
};

export const CARD_WIDTH = 232;
export const CARD_GAP_Y = 144;
export const FRAME_PADDING = 24;

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
    y: 60 + Math.floor(index / FRAME_COLUMNS) * (FRAME_HEIGHT + FRAME_GAP),
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
  }));
}

export function addLocalFrame(frames: LabFrame[], name: string): LabFrame[] {
  const index = frames.length;
  return [
    ...frames,
    {
      id: `local:${index}:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: name.trim(),
      x: 60 + (index % FRAME_COLUMNS) * (FRAME_WIDTH + FRAME_GAP),
      y: 60 + Math.floor(index / FRAME_COLUMNS) * (FRAME_HEIGHT + FRAME_GAP),
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
  const column = index % 1;
  const row = Math.floor(index / 1);
  return snapPoint({
    x: frame.x + FRAME_PADDING + column * (CARD_WIDTH + 18),
    y: frame.y + 60 + row * CARD_GAP_Y,
  });
}

/** Place a local draft in the next readable stack position in its frame. */
export function draftAnchor(frame: LabFrame, nodes: LabNode[]): Point {
  return stack(frame, nodes.filter((node) => node.frame === frame.id).length);
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
