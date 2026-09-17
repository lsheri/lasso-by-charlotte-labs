import { beforeEach, describe, expect, it } from "vitest";

import {
  actionsFor,
  branchChatNode,
  createChatNode,
  createComment,
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
      isConversation: false,
    },
    {
      id: "w2",
      title: "Working session",
      typeLabel: "ai thread",
      source: "chatgpt",
      ownedByViewer: false,
      isConversation: true,
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
  it("places each kind in its own frame", () => {
    const nodes = seedCanvas(SEED);
    const frameOf = (id: string) => nodes.find((node) => node.id === id)?.frame;
    expect(frameOf("brief")).toBe("brief");
    expect(frameOf("task:t1")).toBe("workstreams");
    expect(frameOf("work:w1")).toBe("evidence");
    expect(frameOf("work:w2")).toBe("conversations");
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
    expect(fitScale(200, 100)).toBe(0.4);
    expect(fitScale(0, 0)).toBe(1);
  });
});
