import { beforeEach, describe, expect, it } from "vitest";

import {
  actionsFor,
  CARD_HEIGHT,
  CARD_WIDTH,
  branchChatNode,
  addLabLink,
  addLocalFrame,
  markFrameSaved,
  keepViewportUnscrolled,
  connectedLabNodeIds,
  containFrameMembers,
  createLocalNode,
  deleteLocalNode,
  createChatNode,
  createComment,
  createLabFrames,
  draftAnchor,
  fitScale,
  fitWorkboardViewport,
  fitFrameToNodes,
  frameContainingPoint,
  labAnchorPoint,
  labConnectorPath,
  labConnectorMidpoint,
  labInverseZoom,
  moveNode,
  nearestLabAnchor,
  removeContext,
  relationshipSelection,
  resizeLabRect,
  resetChatCounter,
  resetCommentCounter,
  seedCanvas,
  sizeSeedFrames,
  dropPromptFrame,
  dragEndDecision,
  nextWorkstreamRect,
  workstreamAddAnchor,
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
    expect(frameOf("brief")).toBeUndefined();
    expect(seedCanvas({ ...SEED, savedBrief: true }).find((node) => node.id === "brief")?.frame).toBe("foundation");
    expect(frameOf("work:w1")).toBe("task:t1");
    expect(frameOf("work:w2")).toBe("task:t1");
    expect(frameOf("work:w3")).toBe("outputs");
    expect(frameOf("decision:d1")).toBe("decisions");
  });

  it("grows fresh seed frames to contain six workstream cards and five decisions", () => {
    const crowded = {
      ...SEED,
      work: Array.from({ length: 6 }, (_, index) => ({ id: `w${index}`, title: `Work ${index}`, typeLabel: "document", source: "upload", ownedByViewer: true, taskIds: ["t1"], deliverable: false })),
      decisions: Array.from({ length: 5 }, (_, index) => ({ id: `d${index}`, call: `Decision ${index}`, situation: "Reviewed", ownedByViewer: true })),
    };
    const initial = createLabFrames(crowded.tasks);
    const nodes = seedCanvas(crowded, initial);
    const frames = sizeSeedFrames(initial, nodes);
    for (const node of nodes) {
      const frame = frames.find((entry) => entry.id === node.frame);
      expect(frame).toBeDefined();
      if (!frame) continue;
      expect(node.x).toBeGreaterThanOrEqual(frame.x);
      expect(node.y).toBeGreaterThanOrEqual(frame.y);
      expect(node.x + node.width).toBeLessThanOrEqual(frame.x + frame.width);
      expect(node.y + node.height).toBeLessThanOrEqual(frame.y + frame.height);
    }
  });

  it("keeps every seeded row in a structured frame clear of the row above", () => {
    const crowded = {
      ...SEED,
      work: Array.from({ length: 8 }, (_, index) => ({
        id: `row-${index}`,
        title: `Row ${index}`,
        typeLabel: "document",
        source: "upload",
        ownedByViewer: true,
        taskIds: ["t1"],
        deliverable: false,
      })),
      decisions: [],
    };
    const nodes = seedCanvas(crowded).filter((node) => node.frame === "task:t1");

    for (let first = 0; first < nodes.length; first += 1) {
      for (let second = first + 1; second < nodes.length; second += 1) {
        const a = nodes[first];
        const b = nodes[second];
        if (!a || !b) continue;
        const intersects = a.x < b.x + b.width
          && b.x < a.x + a.width
          && a.y < b.y + b.height
          && b.y < a.y + a.height;
        expect(intersects, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("finds a containing frame and prompts only for a different Structured workstream", () => {
    const frames = createLabFrames(SEED.tasks);
    const node = { ...seedCanvas(SEED, frames).find((entry) => entry.id === "work:w1") };
    expect(node.id).toBe("work:w1");
    const decisions = frames.find((frame) => frame.id === "decisions");
    if (!decisions || !node.id || node.width === undefined || node.height === undefined) return;
    const moved = { ...node, x: decisions.x + 30, y: decisions.y + 80 } as ReturnType<typeof seedCanvas>[number];
    expect(frameContainingPoint(frames, { x: moved.x + moved.width / 2, y: moved.y + moved.height / 2 })?.id).toBe("decisions");
    expect(dropPromptFrame(moved, frames, "structured", true)?.id).toBe("decisions");
    expect(dropPromptFrame(moved, frames, "freeform", true)).toBeNull();
    expect(dropPromptFrame(moved, frames, "structured", false)).toBeNull();
    expect(dropPromptFrame({ ...moved, frame: "decisions" }, frames, "structured", true)).toBeNull();
  });

  it("prompts when a grown home workstream still overlaps the card's new frame", () => {
    const frames = [
      { id: "task:tier2", name: "Tier 2 modelling", x: 60, y: 420, width: 1200, height: 900 },
      { id: "task:readout", name: "Readout deck", x: 900, y: 460, width: 380, height: 420 },
    ];
    const node = { id: "work:w1", frame: "task:tier2", x: 1000, y: 520, width: 232, height: 120 } as ReturnType<typeof seedCanvas>[number];
    expect(frameContainingPoint(frames, { x: node.x + node.width / 2, y: node.y + node.height / 2 })?.id).toBe("task:readout");
    expect(dropPromptFrame(node, frames, "structured", true)?.id).toBe("task:readout");
  });

  it("places a new workstream and the add control clear of every frame and card", () => {
    const frames = createLabFrames(SEED.tasks);
    const nodes = seedCanvas(SEED, frames).map((node) => ({ ...node, y: node.y + 600 }));
    const rect = nextWorkstreamRect(frames, nodes);
    for (const frame of frames) {
      expect(rect.y).toBeGreaterThan(frame.y + frame.height);
    }
    for (const node of nodes) {
      expect(rect.y).toBeGreaterThan(node.y + node.height);
    }
    const created = addLocalFrame(frames, "New stream", rect).at(-1);
    expect(created?.x).toBe(rect.x);
    expect(created?.y).toBe(rect.y);
    const anchor = workstreamAddAnchor(frames, nodes);
    expect(anchor).not.toBeNull();
    for (const frame of frames.filter((entry) => entry.id.startsWith("task:"))) {
      expect(anchor?.y).toBeGreaterThan(frame.y + frame.height);
    }
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

  it("moves and drops cards above and left of the board origin", () => {
    const nodes = seedCanvas(SEED);
    expect(moveNode(nodes, "work:w1", { x: -301, y: -205 }).find((node) => node.id === "work:w1")).toMatchObject({ x: -308, y: -198 });
    const node = nodes.find((entry) => entry.id === "work:w1");
    expect(node).toBeDefined();
    if (!node) return;
    expect(dragEndDecision({ origin: { x: 22, y: 22 }, from: { x: 100, y: 100 }, pointer: { x: 40, y: 30 }, zoom: 1, node, frames: [], mode: "freeform", editable: true }).position).toEqual({ x: -44, y: -44 });
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
    expect(anchor.x).toBeGreaterThanOrEqual(frame.x);
    expect(anchor.x + CARD_WIDTH).toBeLessThanOrEqual(frame.x + frame.width);
    expect(anchor.y).toBeGreaterThanOrEqual(frame.y);
    expect(anchor.y + CARD_HEIGHT).toBeLessThanOrEqual(frame.y + frame.height);

    const roomyFrame = { ...frame, width: 700, height: 800 };
    const first = draftAnchor(roomyFrame, []);
    const nextColumn = draftAnchor(roomyFrame, Array.from({ length: 3 }, (_, index) => ({
      ...nodes[0]!,
      id: `filled:${index}`,
      frame: roomyFrame.id,
    })));
    expect(nextColumn.x).toBeGreaterThan(first.x);
    expect(nextColumn.y).toBe(first.y);

    const lastFitting = draftAnchor(frame, Array.from({ length: 99 }, (_, index) => ({
      ...nodes[0]!,
      id: `full:${index}`,
      frame: frame.id,
    })));
    expect(lastFitting.x + CARD_WIDTH).toBeLessThanOrEqual(frame.x + frame.width);
    expect(lastFitting.y + CARD_HEIGHT).toBeLessThanOrEqual(frame.y + frame.height);
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

  it("fits an NWG-02-sized union at minimum zoom and keeps its visible region centred", () => {
    const largeFrame = { id: "large", name: "All work", x: 60, y: 60, width: 2400, height: 1500 };
    const large = fitWorkboardViewport({ width: 1048, height: 713 }, [largeFrame], [], new Map());
    expect(large.zoom).toBeCloseTo(0.41);
    expect(large.bounds.width * large.zoom).toBeLessThanOrEqual(1048 - 64);
    expect(large.bounds.height * large.zoom).toBeLessThanOrEqual(713 - 64);
    expect(large.pan.x + (large.bounds.x + large.bounds.width / 2) * large.zoom).toBeCloseTo(1048 / 2);
    expect(large.pan.y + (large.bounds.y + large.bounds.height / 2) * large.zoom).toBeCloseTo(713 / 2);

    const oversized = fitWorkboardViewport({ width: 1048, height: 713 }, [{ ...largeFrame, width: 2600, height: 1800 }], [], new Map());
    expect(oversized.zoom).toBe(0.4);
    expect(oversized.pan.x + oversized.bounds.x * oversized.zoom).toBe(32);
    expect(oversized.pan.y + oversized.bounds.y * oversized.zoom).toBe(32);

    const frame = { id: "f", name: "Work", x: 60, y: 420, width: 430, height: 220 };
    const card = { id: "n", kind: "work" as const, frame: "f", title: "Card", summary: "", typeLabel: "work", ownership: "yours" as const, x: 100, y: 590, width: 232, height: 112 };
    const result = fitWorkboardViewport({ width: 1000, height: 700 }, [frame], [card], new Map([["n", 240]]));
    expect(result.bounds.y + result.bounds.height).toBe(830);
    expect(result.pan.x + (result.bounds.x + result.bounds.width / 2) * result.zoom).toBeCloseTo(500);
    expect(result.pan.y + (result.bounds.y + result.bounds.height / 2) * result.zoom).toBeCloseTo(350);
    const tiny = fitWorkboardViewport({ width: 1400, height: 900 }, [], [], new Map(), { x: 10, y: 10, width: 100, height: 80 });
    expect(tiny.zoom).toBe(1);
  });

  it("fits frames and cards above and left of the origin", () => {
    const frame = { id: "f", name: "Work", x: -520, y: -340, width: 430, height: 220 };
    const card = { id: "n", kind: "work" as const, frame: "f", title: "Card", summary: "", typeLabel: "work", ownership: "yours" as const, x: -490, y: -280, width: 232, height: 112 };
    expect(fitFrameToNodes(frame, [card])).toMatchObject({ x: -514, y: -340 });
    const result = fitWorkboardViewport({ width: 1000, height: 700 }, [frame], [card], new Map(), { x: -700, y: -500, width: 100, height: 80 });
    expect(result.bounds.x).toBe(-700);
    expect(result.bounds.y).toBe(-500);
    expect(result.pan.x + (result.bounds.x + result.bounds.width / 2) * result.zoom).toBeCloseTo(500);
    expect(result.pan.y + (result.bounds.y + result.bounds.height / 2) * result.zoom).toBeCloseTo(350);
  });

  it("recognises only real shell size changes", async () => {
    const { viewportSizeChanged } = await import("@/components/canvas-lab/canvas-lab-model");
    expect(viewportSizeChanged(null, { width: 1048, height: 713 })).toBe(true);
    expect(viewportSizeChanged({ width: 1048, height: 713 }, { width: 1048, height: 713 })).toBe(false);
    expect(viewportSizeChanged({ width: 1048, height: 713 }, { width: 1049, height: 713 })).toBe(true);
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
    const result = deleteLocalNode([real, local], [{ id: "l1", fromId: local.id, fromAnchor: "right", toId: real.id, toAnchor: "left" }], [local.id], local.id);
    expect(result.nodes).toEqual([real]);
    expect(result.links).toEqual([]);
    expect(deleteLocalNode([real], [], [], real.id).nodes).toEqual([real]);
  });

  it("rejects self and duplicate local relationships", () => {
    expect(addLabLink([], "a", "right", "a", "left").error).toContain("itself");
    const created = addLabLink([], "a", "right", "b", "left");
    expect(created.error).toBeNull();
    expect(addLabLink(created.links, "a", "right", "b", "left").error).toBe("Already connected");
    expect(addLabLink(created.links, "a", "bottom", "b", "top").error).toBe("Already connected");
    expect(addLabLink(created.links, "b", "left", "a", "right").error).toBeNull();
  });

  it("clears a selected relationship on empty pointer down and Escape decisions", () => {
    expect(relationshipSelection("link-1", "deselect")).toBeNull();
    expect(relationshipSelection(null, "select", "link-2")).toBe("link-2");
  });

  it("resolves anchored card edges and deterministic nearest sides", () => {
    const node = { x: 100, y: 200, width: 232 };
    expect(labAnchorPoint(node, "top", 120)).toEqual({ x: 216, y: 200 });
    expect(labAnchorPoint(node, "right", 120)).toEqual({ x: 332, y: 260 });
    expect(labAnchorPoint(node, "bottom", 120)).toEqual({ x: 216, y: 320 });
    expect(labAnchorPoint(node, "left", 120)).toEqual({ x: 100, y: 260 });
    expect(nearestLabAnchor({ x: 340, y: 260 }, node, 120)).toBe("right");
    expect(nearestLabAnchor({ x: 216, y: 190 }, node, 120)).toBe("top");
    expect(labConnectorPath({ x: 0, y: 0 }, "right", { x: 100, y: 100 }, "left")).toContain("C 64 0, 36 100");
    expect(labConnectorMidpoint({ x: 0, y: 0 }, "right", { x: 100, y: 100 }, "left")).toEqual({ x: 50, y: 50 });
  });

  it("resizes from every corner with minimums and optional aspect ratio", () => {
    const start = { x: 100, y: 100, width: 360, height: 180 };
    expect(resizeLabRect(start, "se", { x: 40, y: 20 })).toEqual({ x: 100, y: 100, width: 400, height: 200 });
    expect(resizeLabRect(start, "nw", { x: 140, y: 80 })).toEqual({ x: 200, y: 100, width: 260, height: 180 });
    expect(resizeLabRect(start, "ne", { x: 40, y: 20 }, true).width / resizeLabRect(start, "ne", { x: 40, y: 20 }, true).height).toBeCloseTo(2);
  });

  it("fits a frame around only its member cards", () => {
    const frame = createLabFrames(SEED.tasks)[1];
    expect(frame).toBeDefined();
    if (!frame) return;
    const members = seedCanvas(SEED).filter((node) => node.frame === frame.id);
    const fitted = fitFrameToNodes(frame, members);
    expect(fitted).not.toBeNull();
    expect(fitted?.width).toBeGreaterThanOrEqual(260);
    expect(fitFrameToNodes(frame, [])).toBeNull();
  });

  it("will not resize a frame boundary through its member cards", () => {
    const frame = createLabFrames(SEED.tasks)[1];
    expect(frame).toBeDefined();
    if (!frame) return;
    const members = seedCanvas(SEED).filter((node) => node.frame === frame.id);
    const constrained = containFrameMembers({ x: frame.x + 200, y: frame.y + 200, width: 260, height: 220 }, frame.id, members);
    expect(constrained.x).toBeLessThanOrEqual(Math.min(...members.map((node) => node.x)) - 24);
    expect(constrained.y).toBeLessThanOrEqual(Math.min(...members.map((node) => node.y)) - 60);
  });

  it("returns only the anchor when there are no local links", () => {
    const nodes = seedCanvas(SEED);
    expect([...connectedLabNodeIds(nodes, [], "work:w3")]).toEqual(["work:w3"]);
  });

  it("includes a directly linked node in either link direction", () => {
    const nodes = seedCanvas(SEED);
    const links = [{ id: "l1", fromId: "work:w1", fromAnchor: "right" as const, toId: "work:w3", toAnchor: "left" as const }];
    expect(connectedLabNodeIds(nodes, links, "work:w3")).toEqual(new Set(["work:w3", "work:w1"]));
  });

  it("walks the full multi-hop local connected component", () => {
    const nodes = seedCanvas(SEED);
    const links = [
      { id: "l1", fromId: "work:w3", fromAnchor: "right" as const, toId: "work:w1", toAnchor: "left" as const },
      { id: "l2", fromId: "work:w1", fromAnchor: "bottom" as const, toId: "work:w2", toAnchor: "top" as const },
    ];
    expect(connectedLabNodeIds(nodes, links, "work:w3")).toEqual(new Set(["work:w3", "work:w1", "work:w2"]));
  });

  it("excludes disconnected local nodes", () => {
    const nodes = seedCanvas(SEED);
    const links = [{ id: "l1", fromId: "work:w3", fromAnchor: "right" as const, toId: "work:w1", toAnchor: "left" as const }];
    expect(connectedLabNodeIds(nodes, links, "work:w3").has("work:w2")).toBe(false);
  });

  it("ignores links whose endpoint is missing", () => {
    const nodes = seedCanvas(SEED);
    const links = [
      { id: "l1", fromId: "work:w3", fromAnchor: "right" as const, toId: "missing", toAnchor: "left" as const },
      { id: "l2", fromId: "missing", fromAnchor: "right" as const, toId: "work:w1", toAnchor: "left" as const },
    ];
    expect([...connectedLabNodeIds(nodes, links, "work:w3")]).toEqual(["work:w3"]);
    expect(connectedLabNodeIds(nodes, links, "missing")).toEqual(new Set());
  });
});

describe("dragEndDecision", () => {
  const frames = [
    { id: "task:tier2", name: "Tier 2 modelling", x: 60, y: 420, width: 1200, height: 900 },
    { id: "custom:readout", name: "Readout deck", x: 900, y: 460, width: 380, height: 420 },
  ];
  const node = { id: "work:w1", frame: "task:tier2", x: 748, y: 638, width: 232, height: 112 } as ReturnType<typeof seedCanvas>[number];

  it("lands the move from the pointerup event even when no render happened", () => {
    const decision = dragEndDecision({
      origin: { x: node.x, y: node.y },
      from: { x: 500, y: 400 },
      pointer: { x: 676, y: 477 },
      zoom: 1,
      node,
      frames,
      mode: "structured",
      editable: true,
    });
    expect(decision.position).toEqual({ x: 924, y: 726 });
    expect(decision.promptFrameId).toBe("custom:readout");
  });

  it("writes nothing when the computed delta is zero", () => {
    const decision = dragEndDecision({
      origin: { x: node.x, y: node.y },
      from: { x: 500, y: 400 },
      pointer: { x: 502, y: 401 },
      zoom: 1,
      node,
      frames,
      mode: "structured",
      editable: true,
    });
    expect(decision.position).toBeNull();
    expect(decision.promptFrameId).toBeNull();
  });

  it("ignores hand jitter in screen pixels at every zoom", () => {
    const base = { origin: { x: node.x, y: node.y }, from: { x: 500, y: 400 }, node, frames, mode: "structured" as const, editable: true };
    expect(dragEndDecision({ ...base, pointer: { x: 503, y: 400 }, zoom: 0.45 }).position).toBeNull();
    expect(dragEndDecision({ ...base, pointer: { x: 503, y: 400 }, zoom: 2 }).position).toBeNull();
    expect(dragEndDecision({ ...base, pointer: { x: 506, y: 400 }, zoom: 0.45 }).position).not.toBeNull();
  });

  it("provides the stage inverse zoom", () => {
    expect(labInverseZoom(0.45)).toBeCloseTo(1 / 0.45);
    expect(labInverseZoom(1.6)).toBeCloseTo(1 / 1.6);
  });

  it("saves without prompting in Freeform or for a read-only card", () => {
    const base = { origin: { x: node.x, y: node.y }, from: { x: 500, y: 400 }, pointer: { x: 676, y: 477 }, zoom: 1, node, frames };
    expect(dragEndDecision({ ...base, mode: "freeform", editable: true }).position).not.toBeNull();
    expect(dragEndDecision({ ...base, mode: "freeform", editable: true }).promptFrameId).toBeNull();
    expect(dragEndDecision({ ...base, mode: "structured", editable: false }).promptFrameId).toBeNull();
  });
});

describe("pass 2b-v board state", () => {
  it("drops the local flag once a frame create comes back saved", () => {
    const frames = addLocalFrame([], "Delivery");
    expect(frames[0]!.local).toBe(true);
    const saved = markFrameSaved(frames, frames[0]!.id, "durable-1", 1);
    expect(saved[0]!.local).toBe(false);
    expect(saved[0]!.durableId).toBe("durable-1");
    expect(saved[0]!.durableVersion).toBe(1);
  });

  it("keeps the surface at the top left when focus tries to scroll it", () => {
    const element = { scrollTop: 218, scrollLeft: 40 };
    keepViewportUnscrolled(element);
    expect(element).toEqual({ scrollTop: 0, scrollLeft: 0 });
  });
});
