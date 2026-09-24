import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { bundleMoveAnnouncement, emptyUndoStacks, popRedo, popUndo, recordUndo, undoAnnouncement, type UndoEntry } from "@/components/canvas-lab/canvas-lab-undo";

/** A tiny stand-in for the page's replay, applied to a frame map. */
function replay(frames: Record<string, string>, entry: UndoEntry, direction: "undo" | "redo") {
  if (entry.action !== "bundle_workstream_move") throw new Error("wrong entry");
  for (const move of entry.moves) frames[move.nodeId] = direction === "undo" ? move.before : move.after;
}

describe("Pass B1 grouped workstream move", () => {
  const entry: UndoEntry = {
    id: "b1",
    action: "bundle_workstream_move",
    chatTitle: "Board structure options",
    moves: [
      { nodeId: "chat", before: "task:a", after: "task:b" },
      { nodeId: "p1", before: "task:a", after: "task:b" },
      { nodeId: "p2", before: "task:c", after: "task:b" },
    ],
  };

  it("undo restores every node's frame and redo re-applies it, as one step", () => {
    const frames: Record<string, string> = { chat: "task:b", p1: "task:b", p2: "task:b" };
    const stacks = recordUndo(emptyUndoStacks(), entry, 1_000);
    expect(stacks.undo).toHaveLength(1);
    const undone = popUndo(stacks);
    replay(frames, undone.entry!, "undo");
    expect(frames).toEqual({ chat: "task:a", p1: "task:a", p2: "task:c" });
    const redone = popRedo(undone.stacks);
    replay(frames, redone.entry!, "redo");
    expect(frames).toEqual({ chat: "task:b", p1: "task:b", p2: "task:b" });
  });

  it("says the chat, the piece count and the workstream", () => {
    expect(bundleMoveAnnouncement("Chat", 2, "Pipeline")).toBe("Chat and its 2 pieces moved to Pipeline.");
    expect(bundleMoveAnnouncement("Chat", 1, "Pipeline")).toBe("Chat and its 1 piece moved to Pipeline.");
    expect(undoAnnouncement("workstream_move", "undo")).toBe("Undid move to a workstream.");
  });

  it("moveToFrame on a bundled chat records the grouped step, and a lone chat keeps workstream_move", () => {
    const source = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const body = source.slice(source.indexOf("function moveToFrame("), source.indexOf("function addNode("));
    expect(body).toContain("bundles.get(node.id)");
    expect(body).toContain('record({ action: "bundle_workstream_move", chatTitle: node.title, moves });');
    expect(body).toContain('record({ action: "workstream_move", nodeId: node.id, before: node.frame ?? "", after: frameId });');
    expect(body).not.toContain("logEvent");
  });
});
