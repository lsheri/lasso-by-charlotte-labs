import { describe, expect, it } from "vitest";

import { eventKind, retryAction, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import {
  UNDO_LIMIT,
  emptyUndoStacks,
  popRedo,
  popUndo,
  recordUndo,
  undoAnnouncement,
  undoKeyIntent,
  type UndoEntry,
} from "@/components/canvas-lab/canvas-lab-undo";

function move(nodeId: string, x: number, coalesce?: string): UndoEntry {
  return { action: "move", nodeId, before: { x: 0, y: 0 }, after: { x, y: 0 }, ...(coalesce ? { coalesceKey: coalesce } : {}) };
}

function workNode(deliverable: boolean): LabNode {
  return { id: "work:1", kind: "work", frame: "foundation", title: "A deck", summary: "", typeLabel: "deck", ownership: "yours", workItemId: "1", deliverable, x: 0, y: 0, width: 232, height: 112 };
}

describe("canvas lab undo stack", () => {
  it("pushes, undoes and redoes one step", () => {
    const stacks = recordUndo(emptyUndoStacks(), move("a", 10), 1_000);
    const undone = popUndo(stacks);
    expect(undone.entry?.action).toBe("move");
    expect(undone.stacks.undo).toHaveLength(0);
    expect(undone.stacks.redo).toHaveLength(1);
    const redone = popRedo(undone.stacks);
    expect(redone.entry).toBe(undone.entry);
    expect(redone.stacks.undo).toHaveLength(1);
    expect(redone.stacks.redo).toHaveLength(0);
  });

  it("keeps at most twenty steps", () => {
    let stacks = emptyUndoStacks();
    for (let index = 0; index < 25; index += 1) stacks = recordUndo(stacks, move(`n${index}`, index), 1_000 + index);
    expect(stacks.undo).toHaveLength(UNDO_LIMIT);
    expect((stacks.undo[0] as { nodeId: string }).nodeId).toBe("n5");
  });

  it("clears the redo side when a new step is recorded", () => {
    const first = recordUndo(emptyUndoStacks(), move("a", 10), 1_000);
    const undone = popUndo(first);
    const next = recordUndo(undone.stacks, move("b", 20), 2_000);
    expect(next.redo).toHaveLength(0);
    expect(popRedo(next).entry).toBeNull();
  });

  it("coalesces consecutive keyboard nudges of one card", () => {
    let stacks = recordUndo(emptyUndoStacks(), move("a", 8, "nudge:a"), 1_000);
    stacks = recordUndo(stacks, move("a", 16, "nudge:a"), 1_400);
    expect(stacks.undo).toHaveLength(1);
    const entry = stacks.undo[0] as { before: { x: number }; after: { x: number } };
    expect(entry.before.x).toBe(0);
    expect(entry.after.x).toBe(16);
    stacks = recordUndo(stacks, move("a", 24, "nudge:a"), 4_000);
    expect(stacks.undo).toHaveLength(2);
  });

  it("says the plain word for each direction", () => {
    expect(undoAnnouncement("move", "undo")).toBe("Undid move.");
    expect(undoAnnouncement("move", "redo")).toBe("Redid move.");
  });

  it("reads the keys, and leaves text fields to their own undo", () => {
    expect(undoKeyIntent({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false }, false)).toBe("undo");
    expect(undoKeyIntent({ key: "Z", ctrlKey: false, metaKey: true, shiftKey: true }, false)).toBe("redo");
    expect(undoKeyIntent({ key: "y", ctrlKey: true, metaKey: false, shiftKey: false }, false)).toBe("redo");
    expect(undoKeyIntent({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false }, true)).toBeNull();
    expect(undoKeyIntent({ key: "z", ctrlKey: false, metaKey: false, shiftKey: false }, false)).toBeNull();
  });
});

describe("closed event vocabulary corrections", () => {
  it("calls a deliverable work card a deliverable", () => {
    expect(eventKind(workNode(true))).toBe("deliverable");
    expect(eventKind(workNode(false))).toBe("source");
  });

  it("reports a retried create as a create", () => {
    expect(retryAction({ type: "node_create", node: { clientKey: "k", frameKey: "foundation", x: 0, y: 0, w: 1, h: 1, hidden: false, kind: "brief" } })).toBe("create");
    expect(retryAction({ type: "node_archive", nodeId: "n", expectedVersion: 1 })).toBe("archive");
    expect(retryAction({ type: "node_restore", nodeId: "n", expectedVersion: 1 })).toBe("restore");
    expect(retryAction({ type: "node_update", nodeId: "n", expectedVersion: 1, patch: { x: 1 } })).toBe("update");
  });
});
