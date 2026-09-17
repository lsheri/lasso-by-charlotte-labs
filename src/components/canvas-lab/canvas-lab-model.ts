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

export type LabFrameId = "brief" | "workstreams" | "evidence" | "decisions" | "conversations";

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
  /** Set on example collaborator cards so the surface can label them. */
  example?: boolean;
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
};

export const CARD_WIDTH = 232;
export const CARD_GAP_Y = 108;
export const LIVE_CARD_EXTRA = 118;
export const FRAME_PADDING = 24;

export const LAB_FRAMES: LabFrame[] = [
  { id: "brief", name: "Brief", x: 60, y: 60, width: 300, height: 320 },
  { id: "workstreams", name: "Workstreams", x: 420, y: 60, width: 300, height: 620 },
  { id: "evidence", name: "Evidence", x: 780, y: 60, width: 300, height: 760 },
  { id: "decisions", name: "Decisions", x: 1140, y: 60, width: 300, height: 620 },
  { id: "conversations", name: "Conversations", x: 1500, y: 60, width: 320, height: 760 },
];

export function frameById(id: LabFrameId): LabFrame {
  return LAB_FRAMES.find((frame) => frame.id === id) ?? (LAB_FRAMES[0] as LabFrame);
}

/** Stage size, wide enough that every frame sits inside it with air. */
export const STAGE_WIDTH = 1980;
export const STAGE_HEIGHT = 980;

export type SeedInput = {
  brief: { title: string; text: string | null } | null;
  tasks: { id: string; name: string; detail: string | null; ownedByViewer: boolean }[];
  work: {
    id: string;
    title: string;
    typeLabel: string;
    source: string;
    ownedByViewer: boolean;
    isConversation: boolean;
  }[];
  decisions: { id: string; call: string; situation: string; ownedByViewer: boolean }[];
};

function stack(frame: LabFrame, index: number): Point {
  return snapPoint({
    x: frame.x + FRAME_PADDING,
    y: frame.y + 56 + index * CARD_GAP_Y,
  });
}

/**
 * The opening arrangement. Real content first, in the frame that explains it.
 * A frame with nothing in it still renders, so an absent kind reads as empty
 * rather than missing.
 */
export function seedCanvas(input: SeedInput): LabNode[] {
  const nodes: LabNode[] = [];

  if (input.brief) {
    const at = stack(frameById("brief"), 0);
    nodes.push({
      id: "brief",
      kind: "brief",
      frame: "brief",
      title: input.brief.title,
      summary: input.brief.text ?? "No brief written yet.",
      typeLabel: "brief",
      ownership: "yours",
      x: at.x,
      y: at.y,
    });
  }

  input.tasks.forEach((task, index) => {
    const at = stack(frameById("workstreams"), index);
    nodes.push({
      id: `task:${task.id}`,
      kind: "task",
      frame: "workstreams",
      title: task.name,
      summary: task.detail ?? "No detail on this workstream.",
      typeLabel: "workstream",
      ownership: task.ownedByViewer ? "yours" : "teammate",
      x: at.x,
      y: at.y,
    });
  });

  let evidenceIndex = 0;
  let conversationIndex = 0;
  for (const item of input.work) {
    const frame: LabFrameId = item.isConversation ? "conversations" : "evidence";
    const index = item.isConversation ? conversationIndex : evidenceIndex;
    if (item.isConversation) conversationIndex += 1;
    else evidenceIndex += 1;
    const at = stack(frameById(frame), index);
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
    const at = stack(frameById("decisions"), index);
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
  anchor: Point = { x: 1520, y: 520 },
): LabNode {
  chatCounter += 1;
  const at = snapPoint({ x: anchor.x, y: anchor.y + (chatCounter - 1) * 40 });
  return {
    id: `chat:${chatCounter}`,
    kind: "chat",
    frame: "conversations",
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
  });
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
export function fitScale(viewportWidth: number, viewportHeight: number): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 1;
  const scale = Math.min(viewportWidth / (STAGE_WIDTH + 80), viewportHeight / (STAGE_HEIGHT + 80));
  return Math.max(0.4, Math.min(1.6, scale));
}
