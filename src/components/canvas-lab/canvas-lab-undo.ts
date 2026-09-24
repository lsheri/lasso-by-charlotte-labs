/**
 * Canvas Lab undo, as pure state.
 *
 * A bounded stack of the arranging moves a person made on their own board.
 * No React, no DOM, no database. The page decides how to apply an entry; this
 * module only decides what is on the stack and in what order.
 */

import type { LabLink, LabNode, LabRect } from "@/components/canvas-lab/canvas-lab-model";

export type UndoAction =
  | "move"
  | "resize"
  | "hide"
  | "restore"
  | "remove_note"
  | "relationship_add"
  | "relationship_remove"
  | "link_relation"
  | "workstream_move"
  | "bundle_workstream_move";

export type UndoDirection = "undo" | "redo";

export type UndoEntry =
  | { id: string; action: "move"; nodeId: string; before: { x: number; y: number }; after: { x: number; y: number }; coalesceKey?: string; at?: number }
  | { id: string; action: "resize"; kind: "card" | "frame"; targetId: string; before: LabRect; after: LabRect; coalesceKey?: string; at?: number }
  | { id: string; action: "hide"; nodeId: string; coalesceKey?: string; at?: number }
  | { id: string; action: "restore"; nodeId: string; before: { x: number; y: number }; after: { x: number; y: number }; coalesceKey?: string; at?: number }
  | { id: string; action: "remove_note"; node: LabNode; links: LabLink[]; coalesceKey?: string; at?: number }
  | { id: string; action: "relationship_add"; link: LabLink; coalesceKey?: string; at?: number }
  | { id: string; action: "relationship_remove"; link: LabLink; coalesceKey?: string; at?: number }
  | { id: string; action: "link_relation"; linkId: string; before: string; after: string; coalesceKey?: string; at?: number }
  | { id: string; action: "workstream_move"; nodeId: string; before: string; after: string; coalesceKey?: string; at?: number }
  | { id: string; action: "bundle_workstream_move"; chatTitle: string; moves: { nodeId: string; before: string; after: string }[]; coalesceKey?: string; at?: number };

export type UndoEntryDraft = UndoEntry extends infer Entry
  ? Entry extends UndoEntry ? Omit<Entry, "id" | "at"> & { at?: number } : never
  : never;

export type UndoStacks = { undo: UndoEntry[]; redo: UndoEntry[] };

/** Twenty steps is as far back as one visit to a board reaches. */
export const UNDO_LIMIT = 20;

/** Consecutive keyboard nudges of one card read as a single move. */
export const UNDO_COALESCE_MS = 1_000;

export function emptyUndoStacks(): UndoStacks {
  return { undo: [], redo: [] };
}

/** A new recorded action always clears whatever was waiting to be redone. */
export function recordUndo(stacks: UndoStacks, entry: UndoEntry, now: number = Date.now()): UndoStacks {
  const stamped: UndoEntry = { ...entry, at: now };
  const top = stacks.undo[stacks.undo.length - 1];
  if (
    stamped.coalesceKey &&
    top &&
    top.coalesceKey === stamped.coalesceKey &&
    top.action === stamped.action &&
    now - (top.at ?? 0) <= UNDO_COALESCE_MS
  ) {
    const merged = { ...stamped, id: top.id, before: (top as { before?: unknown }).before ?? (stamped as { before?: unknown }).before } as UndoEntry;
    return { undo: [...stacks.undo.slice(0, -1), merged], redo: [] };
  }
  return { undo: [...stacks.undo, stamped].slice(-UNDO_LIMIT), redo: [] };
}

export function popUndo(stacks: UndoStacks): { stacks: UndoStacks; entry: UndoEntry | null } {
  const entry = stacks.undo[stacks.undo.length - 1];
  if (!entry) return { stacks, entry: null };
  return { stacks: { undo: stacks.undo.slice(0, -1), redo: [...stacks.redo, entry].slice(-UNDO_LIMIT) }, entry };
}

export function popRedo(stacks: UndoStacks): { stacks: UndoStacks; entry: UndoEntry | null } {
  const entry = stacks.redo[stacks.redo.length - 1];
  if (!entry) return { stacks, entry: null };
  return { stacks: { undo: [...stacks.undo, entry].slice(-UNDO_LIMIT), redo: stacks.redo.slice(0, -1) }, entry };
}

/** A toast may only take back the exact step it was opened for. */
export function canUndoToastEntry(stacks: UndoStacks, entryId: string): boolean {
  return stacks.undo[stacks.undo.length - 1]?.id === entryId;
}

/** The plain word said back to the person for each action. */
export function undoActionWord(action: UndoAction): string {
  if (action === "move") return "move";
  if (action === "resize") return "resize";
  if (action === "hide") return "removal from the board";
  if (action === "restore") return "restore";
  if (action === "remove_note") return "note removal";
  if (action === "relationship_add") return "relationship";
  if (action === "relationship_remove") return "relationship removal";
  if (action === "link_relation") return "what this link means";
  if (action === "bundle_workstream_move") return "move of a chat and its pieces";
  return "move to a workstream";
}

/** Pass B1: what is said when a chat and its docked pieces change workstream together. */
export function bundleMoveAnnouncement(chatTitle: string, pieces: number, workstream: string): string {
  return `${chatTitle} and its ${pieces} ${pieces === 1 ? "piece" : "pieces"} moved to ${workstream}.`;
}

export function undoAnnouncement(action: UndoAction, direction: UndoDirection): string {
  return `${direction === "undo" ? "Undid" : "Redid"} ${undoActionWord(action)}.`;
}

/** Which way the keys point, or nothing when they are not an undo request. */
export function undoKeyIntent(
  event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  inTextField: boolean,
): UndoDirection | null {
  if (inTextField) return null;
  if (!event.ctrlKey && !event.metaKey) return null;
  const key = event.key.toLowerCase();
  if (key === "y") return "redo";
  if (key !== "z") return null;
  return event.shiftKey ? "redo" : "undo";
}
