import { beforeEach, describe, expect, it } from "vitest";

import {
  actionsFor,
  branchChatNode,
  addLabLink,
  connectedLabNodeIds,
  createLocalNode,
  deleteLocalNode,
  createChatNode,
  createComment,
  createLabFrames,
  draftAnchor,
  fitScale,
  moveNode,
  removeContext,
  resetChatCounter,
  resetCommentCounter,
  seedCanvas,
  toggleContext,
} from "@/components/canvas-lab/canvas-lab-model";

const SEED = {
  brief: { title: "The brief", text: "Cut the cost base without cutting the team." },
  tasks: [{ id: "t1", name: "Diagnostic", detail: null, ownedByViewer: true }],
  work: [
    {
      id: "w1",
      title: "Cost model",
      typeLabel: "sheet",
      source: "upload",
      ownedByViewer: true,
      taskIds: ["t1"],
      deliverable: false,
    },
    {
      id: "w2",
      title: "Working session",
      typeLabel: "ai thread",
      source: "chatgpt",
      ownedByViewer: false,
      taskIds: ["t1"],
      deliverable: false,
    },
    {
      id: "w3",
      title: "Final recommendation",
      typeLabel: "deck",
      source: "upload",
      ownedByViewer: true,
      taskIds: ["t1"],
      deliverable: true,
    },
  ],
  decisions: [
    { id: "d1", call: "Keep the pilot", situation: "Two options on the table", ownedByViewer: true },
  ],
};

beforeEach(() => {
  resetChatCounter();
  resetCommentCounter();
});

describe("canvas lab model", () => {
  it("creates consulting frames from the real workstreams", () => {
    const frames = createLabFrames(SEED.tasks);
    expect(frames.map((frame) => frame.name)).toEqual([
      "Foundation",
      "Diagnostic",
      "Decisions",
      "Outputs",
    ]);
  });

  it("maps the brief, work, calls, and deliverables into consulting frames", () => {
    const nodes = seedCanvas(SEED);
    const frameOf = (id: string) => nodes.find((node) => node.id === id)?.frame;
    expect(frameOf("brief")).toBe("foundation");
    expect(frameOf("work:w1")).toBe("task:t1");
    expect(frameOf("work:w2")).toBe("task:t1");
    expect(frameOf("work:w3")).toBe("outputs");
    expect(frameOf("decision:d1")).toBe("decisions");
  });

  it("marks work the viewer does not own as a teammate's", () => {
    const nodes = seedCanvas(SEED);
    expect(nodes.find((node) => node.id === "work:w1")?.ownership).toBe("yours");
    expect(nodes.find((node) => node.id === "work:w2")?.ownership).toBe("teammate");
  });

  it("seeds nothing for an absent kind", () => {
    const nodes = seedCanvas({ brief: null, tasks: [], work: [], decisions: [] });
    expect(nodes).toHaveLength(0);
  });

  it("moves one card and leaves the rest alone", () => {
    const nodes = seedCanvas(SEED);
    const before = nodes.find((node) => node.id === "task:t1");
    const moved = moveNode(nodes, "work:w1", { x: 301, y: 205 });
    expect(moved.find((node) => node.id === "work:w1")).toMatchObject({ x: 308, y: 198 });
    expect(moved.find((node) => node.id === "task:t1")).toEqual(before);
  });

  it("adds and removes context", () => {
    expect(toggleContext([], "work:w1")).toEqual(["work:w1"]);
    expect(toggleContext(["work:w1"], "work:w1")).toEqual([]);
    expect(removeContext(["a", "b"], "a")).toEqual(["b"]);
  });

  it("makes a local chat card that never claims an answer", () => {
    const chat = createChatNode("What changed between these two?", ["work:w1"]);
    expect(chat.kind).toBe("chat");
    expect(chat.ownership).toBe("draft");
    expect(chat.contextIds).toEqual(["work:w1"]);
    expect(chat.summary).toContain("AI connection is off in this prototype");
  });

  it("branches without touching the card it came from", () => {
    const chat = createChatNode("First pass", ["work:w1", "work:w2"]);
    const snapshot = { ...chat, contextIds: [...(chat.contextIds ?? [])] };
    const branch = branchChatNode(chat);
    expect(chat).toEqual(snapshot);
    expect(branch.id).not.toBe(chat.id);
    expect(branch.contextIds).toEqual(["work:w1", "work:w2"]);
    expect(branch.title).toContain("Branch of");
    expect(branch.frame).toBe(chat.frame);
  });

  it("places a draft at the next stack position inside its chosen frame", () => {
    const frames = createLabFrames(SEED.tasks);
    const nodes = seedCanvas(SEED, frames);
    const frame = frames.find((candidate) => candidate.id === "task:t1");
    expect(frame).toBeDefined();
    if (!frame) return;
    const anchor = draftAnchor(frame, nodes);
    expect(anchor.x).toBeGreaterThan(frame.x);
    expect(anchor.x).toBeLessThan(frame.x + frame.width);
    expect(anchor.y).toBeGreaterThan(frame.y);
    expect(anchor.y).toBeLessThan(frame.y + frame.height);
  });

  it("arranges seven pilot frames across two rows", () => {
    const frames = createLabFrames([
      { id: "t1", name: "One" },
      { id: "t2", name: "Two" },
      { id: "t3", name: "Three" },
      { id: "t4", name: "Four" },
    ]);
    expect(frames).toHaveLength(7);
    expect(new Set(frames.map((frame) => frame.y)).size).toBe(2);
    expect(frames.filter((frame) => frame.y === frames[0]?.y)).toHaveLength(4);
  });

  it("offers a teammate's work read actions only", () => {
    expect(actionsFor("teammate")).toEqual(["Read", "Summarize", "Branch", "Comment"]);
    expect(actionsFor("teammate")).not.toContain("Delete");
    expect(actionsFor("yours")).toEqual(["Arrange", "Open"]);
    expect(actionsFor("draft")).toContain("Edit here");
  });

  it("keeps a comment attached to its card and its quote", () => {
    const comment = createComment("work:w2", "the number moved twice", "Which pass was this?", "Liam");
    expect(comment.nodeId).toBe("work:w2");
    expect(comment.quote).toBe("the number moved twice");
    expect(comment.author).toBe("Liam");
  });

  it("fits the stage inside the viewport and holds the zoom range", () => {
    expect(fitScale(1000, 600)).toBeLessThan(1);
    expect(fitScale(200, 100)).toBe(0.62);
    expect(fitScale(0, 0)).toBe(1);
  });

  it("creates the five local reasoning node kinds and six judgment choices", async () => {
    const model = await import("@/components/canvas-lab/canvas-lab-model");
    expect(model.REASONING_STEPS.map((step) => step.label)).toEqual([
      "Source / Context", "AI work", "Human judgment", "Decision", "Deliverable",
    ]);
    expect(model.JUDGMENT_TYPES).toHaveLength(6);
  });

  it("places repeated local nodes deterministically without the same anchor", () => {
    const frame = createLabFrames(SEED.tasks)[0];
    expect(frame).toBeDefined();
    if (!frame) return;
    const first = createLocalNode("source", frame, []);
    const second = createLocalNode("source", frame, [first]);
    expect([second.x, second.y]).not.toEqual([first.x, first.y]);
  });

  it("deletes only local nodes and removes their links and context", () => {
    const frame = createLabFrames(SEED.tasks)[0];
    expect(frame).toBeDefined();
    if (!frame) return;
    const local = createLocalNode("judgment", frame, [], "corrected_ai");
    const real = seedCanvas(SEED)[0];
    expect(real).toBeDefined();
    if (!real) return;
    const result = deleteLocalNode([real, local], [{ id: "l1", fromId: local.id, toId: real.id }], [local.id], local.id);
    expect(result.nodes).toEqual([real]);
    expect(result.links).toEqual([]);
    expect(deleteLocalNode([real], [], [], real.id).nodes).toEqual([real]);
  });

  it("rejects self and duplicate local relationships", () => {
    expect(addLabLink([], "a", "a").error).toContain("itself");
    const created = addLabLink([], "a", "b");
    expect(created.error).toBeNull();
    expect(addLabLink(created.links, "a", "b").error).toContain("already connected");
  });

  it("returns only the anchor when there are no local links", () => {
    const nodes = seedCanvas(SEED);
    expect([...connectedLabNodeIds(nodes, [], "work:w3")]).toEqual(["work:w3"]);
  });

  it("includes a directly linked node in either link direction", () => {
    const nodes = seedCanvas(SEED);
    const links = [{ id: "l1", fromId: "work:w1", toId: "work:w3" }];
    expect(connectedLabNodeIds(nodes, links, "work:w3")).toEqual(new Set(["work:w3", "work:w1"]));
  });

  it("walks the full multi-hop local connected component", () => {
    const nodes = seedCanvas(SEED);
    const links = [
      { id: "l1", fromId: "work:w3", toId: "work:w1" },
      { id: "l2", fromId: "work:w1", toId: "work:w2" },
    ];
    expect(connectedLabNodeIds(nodes, links, "work:w3")).toEqual(new Set(["work:w3", "work:w1", "work:w2"]));
  });

  it("excludes disconnected local nodes", () => {
    const nodes = seedCanvas(SEED);
    const links = [{ id: "l1", fromId: "work:w3", toId: "work:w1" }];
    expect(connectedLabNodeIds(nodes, links, "work:w3").has("work:w2")).toBe(false);
  });

  it("ignores links whose endpoint is missing", () => {
    const nodes = seedCanvas(SEED);
    const links = [
      { id: "l1", fromId: "work:w3", toId: "missing" },
      { id: "l2", fromId: "missing", toId: "work:w1" },
    ];
    expect([...connectedLabNodeIds(nodes, links, "work:w3")]).toEqual(["work:w3"]);
    expect(connectedLabNodeIds(nodes, links, "missing")).toEqual(new Set());
  });
});
