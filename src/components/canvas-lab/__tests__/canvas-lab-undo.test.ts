import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { clearUnpinned, readAskPins, readUnpinned, removeAskPin, writeAskPin, writeUnpinned } from "@/lib/ask-draft";

import { deleteLocalNode, eventKind, retryAction, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import {
  UNDO_LIMIT,
  canUndoToastEntry,
  emptyUndoStacks,
  popRedo,
  popUndo,
  recordUndo,
  undoAnnouncement,
  undoKeyIntent,
  type UndoEntry,
} from "@/components/canvas-lab/canvas-lab-undo";

function move(nodeId: string, x: number, coalesce?: string): UndoEntry {
  return { id: `move:${nodeId}:${x}`, action: "move", nodeId, before: { x: 0, y: 0 }, after: { x, y: 0 }, ...(coalesce ? { coalesceKey: coalesce } : {}) };
}

function workNode(deliverable: boolean): LabNode {
  return { id: "work:1", kind: "work", frame: "foundation", title: "A deck", summary: "", typeLabel: "deck", ownership: "yours", workItemId: "1", deliverable, x: 0, y: 0, width: 232, height: 112 };
}

describe("canvas lab undo stack", () => {
  it("FIX-1 deleteNode on a pinned answer remembers the pin for its remove_note entry", () => {
    // Execute the page's actual deleteNode pin block in isolation.
    const source = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const start = source.indexOf("    // FIX-1: a kept answer removed by any path");
    const end = source.indexOf("    // A judgment belongs to whoever wrote it.", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const run = new Function("node", "extra", "context", `
      const { window, engagementId, readAskPins, writeUnpinned, removeAskPin } = context;
      ${source.slice(start, end).replace("let store: Storage | null = null;", "let store = null;")}
      return extra;
    `);
    const data = new Map<string, string>();
    const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    writeAskPin("answer:1", "chat:1", store);
    const node = { ...workNode(false), id: "answer:1", kind: "answer" as const, local: true };
    const context = { window: { localStorage: store }, engagementId: "board:1", readAskPins, writeUnpinned, removeAskPin };
    expect(run(node, undefined, context)).toEqual({ pin: { key: "answer:1", sessionId: "chat:1" } });
    expect(readAskPins(store)).toEqual({});
    expect(readUnpinned(store)).toEqual({ "chat:1": "board:1" });
    // Already carried by unpinAnswer-style callers: untouched, no second write.
    const given = { pin: { key: "answer:1", sessionId: "chat:1" } };
    expect(run(node, given, context)).toBe(given);
  });

  it("FIX-1 restoreNode puts the work placement back for a work card", () => {
    const source = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const start = source.indexOf("  function restoreNode(id: string) {");
    const end = source.indexOf("\n  }\n", start);
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(source.indexOf("{", start) + 1, end);
    const run = new Function("id", "context", `
      const { allNodes, boardFrames, localNodeAnchor, visibleNodes, setNodes, setHiddenIds, setWorkPlacement, persistNodePatch, noteWorkboardRecordVisibility, orgId, setAnnouncement, record } = context;
      ${body}
    `);
    const setWorkPlacement = vi.fn(async () => undefined);
    const node = workNode(false);
    run(node.id, {
      allNodes: [node], boardFrames: [{ id: "foundation" }], localNodeAnchor: () => ({ x: 1, y: 2 }), visibleNodes: [],
      setNodes: vi.fn(), setHiddenIds: vi.fn(), setWorkPlacement, persistNodePatch: vi.fn(async () => undefined),
      noteWorkboardRecordVisibility: vi.fn(), orgId: "org", setAnnouncement: vi.fn(), record: vi.fn(),
    });
    expect(setWorkPlacement).toHaveBeenCalledWith("work:1", true);
  });

  it("PIN-2 restores a removed chat pin on undo and removes it again on redo", () => {
    // Execute the page's actual remove_note branch without mounting its unrelated queries.
    const source = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const start = source.indexOf('    if (entry.action === "remove_note") {');
    const end = source.indexOf('    if (entry.action === "relationship_add"', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const apply = new Function("entry", "direction", "context", `
      const { window, engagementId, setNodes, setLinks, setSelected, linksRef, selected,
        writeAskPin, clearUnpinned, writeUnpinned, removeAskPin, deleteLocalNode } = context;
      ${source.slice(start, end).replace("let store: Storage | null = null;", "let store = null;")}
    `);
    const data = new Map<string, string>();
    const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    const node = { ...workNode(false), id: "answer:1", kind: "answer" as const, local: true };
    const entry: UndoEntry = { id: "remove:1", action: "remove_note", node, links: [], pin: { key: "answer:1", sessionId: "chat:1" } };
    let nodes: LabNode[] = [];
    let links: LabLink[] = [];
    const context = {
      window: { localStorage: store }, engagementId: "board:1",
      setNodes: (update: (current: LabNode[]) => LabNode[]) => { nodes = update(nodes); },
      setLinks: (update: LabLink[] | ((current: LabLink[]) => LabLink[])) => { links = typeof update === "function" ? update(links) : update; },
      setSelected: vi.fn(), linksRef: { current: links }, selected: [],
      writeAskPin, clearUnpinned, writeUnpinned, removeAskPin, deleteLocalNode,
    };
    writeUnpinned("chat:1", "board:1", store);
    writeUnpinned("chat:other", "board:other", store);
    const undone = popUndo(recordUndo(emptyUndoStacks(), entry));
    apply(undone.entry, "undo", context);
    expect(nodes.map((node) => node.id)).toEqual(["answer:1"]);
    expect(readAskPins(store)).toEqual({ "answer:1": "chat:1" });
    expect(readUnpinned(store)).toEqual({ "chat:other": "board:other" });
    apply(popRedo(undone.stacks).entry, "redo", context);
    expect(nodes).toEqual([]);
    expect(readAskPins(store)).toEqual({});
    expect(readUnpinned(store)).toEqual({ "chat:1": "board:1", "chat:other": "board:other" });
  });

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
    expect(stacks.undo[0]?.id).toBe("move:a:8");
    stacks = recordUndo(stacks, move("a", 24, "nudge:a"), 4_000);
    expect(stacks.undo).toHaveLength(2);
  });

  it("matches a toast step by stable id only while it remains on top", () => {
    const toastEntry = move("a", 10);
    const first = recordUndo(emptyUndoStacks(), toastEntry, 1_000);
    expect(canUndoToastEntry(first, toastEntry.id)).toBe(true);
    expect(canUndoToastEntry(first, toastEntry.id) ? popUndo(first).entry?.id : null).toBe(toastEntry.id);

    const later = recordUndo(first, move("b", 20), 2_000);
    expect(canUndoToastEntry(later, toastEntry.id)).toBe(false);
    expect(canUndoToastEntry(later, toastEntry.id) ? popUndo(later).entry : null).toBeNull();
    expect(later.undo).toHaveLength(2);
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
