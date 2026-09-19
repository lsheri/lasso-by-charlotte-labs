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
  | "workstream_move";

export type UndoDirection = "undo" | "redo";

export type UndoEntry =
  | { action: "move"; nodeId: string; before: { x: number; y: number }; after: { x: number; y: number }; coalesceKey?: string; at?: number }
  | { action: "resize"; kind: "card" | "frame"; id: string; before: LabRect; after: LabRect; coalesceKey?: string; at?: number }
  | { action: "hide"; nodeId: string; coalesceKey?: string; at?: number }
  | { action: "restore"; nodeId: string; before: { x: number; y: number }; after: { x: number; y: number }; coalesceKey?: string; at?: number }
  | { action: "remove_note"; node: LabNode; links: LabLink[]; coalesceKey?: string; at?: number }
  | { action: "relationship_add"; link: LabLink; coalesceKey?: string; at?: number }
  | { action: "relationship_remove"; link: LabLink; coalesceKey?: string; at?: number }
  | { action: "workstream_move"; nodeId: string; before: string; after: string; coalesceKey?: string; at?: number };

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
    const merged = { ...stamped, before: (top as { before?: unknown }).before ?? (stamped as { before?: unknown }).before } as UndoEntry;
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

/** The plain word said back to the person for each action. */
export function undoActionWord(action: UndoAction): string {
  if (action === "move") return "move";
  if (action === "resize") return "resize";
  if (action === "hide") return "removal from the board";
  if (action === "restore") return "restore";
  if (action === "remove_note") return "note removal";
  if (action === "relationship_add") return "relationship";
  if (action === "relationship_remove") return "relationship removal";
  return "move to a workstream";
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
