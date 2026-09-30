/**
 * Unit 4e: drag and drop in the sidebar tree. Pure pieces only, so the rules
 * a test pins are the rules the sidebar runs.
 *
 * Drag changes what something is inside, never its place among siblings.
 * The database owns every tree rule (depth, cycles, clients nested, other
 * workspaces). The one rule checked here is self and descendant, so a person
 * never drags a parent into its own child and watches it snap back.
 */
import { containerDepth, type ContainerRow, type NavEngagement } from "@/lib/nav-groups";

export type DragItem =
  | { type: "container"; id: string; kind: "client" | "folder" }
  | { type: "workboard"; id: string; clientId: string | null };

/** A container row, or the top level (null container). */
export type DropTarget = { type: "container"; id: string } | { type: "top" };

export const DRAG_MIME = "application/x-lasso-sidebar";

/** Where a drop would put the item: a container id, or null for top level. */
export function destinationOf(target: DropTarget): string | null {
  return target.type === "container" ? target.id : null;
}

/**
 * True when `targetId` is `movingId` itself or sits anywhere beneath it.
 * Walks up from the target through parent_id; a visited set stops a loop.
 */
export function isSelfOrDescendant(
  rows: readonly ContainerRow[],
  movingId: string,
  targetId: string,
): boolean {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  let current: string | null | undefined = targetId;
  while (current && !seen.has(current)) {
    if (current === movingId) return true;
    seen.add(current);
    current = byId.get(current)?.parent_id ?? null;
  }
  return false;
}

/** The current container of the dragged item. */
export function currentParentOf(rows: readonly ContainerRow[], item: DragItem): string | null {
  if (item.type === "workboard") return item.clientId;
  return rows.find((row) => row.id === item.id)?.parent_id ?? null;
}

/**
 * Whether a target accepts the drop. Refuses self and descendant for a
 * container, and a drop onto where the item already is. Nothing else: every
 * other refusal belongs to the database.
 */
export function canDropOn(
  rows: readonly ContainerRow[],
  item: DragItem,
  target: DropTarget,
): boolean {
  const to = destinationOf(target);
  if (item.type === "container" && to && isSelfOrDescendant(rows, item.id, to)) return false;
  return currentParentOf(rows, item) !== to;
}

/** Pending optimistic moves: item key to destination container (or null). */
export type PendingMoves = Record<string, string | null>;
export const moveKey = (item: Pick<DragItem, "type" | "id">) => `${item.type}:${item.id}`;

export function applyContainerMoves(rows: readonly ContainerRow[], pending: PendingMoves): ContainerRow[] {
  return rows.map((row) => {
    const key = `container:${row.id}`;
    return key in pending ? { ...row, parent_id: pending[key] ?? null } : row;
  });
}

export function applyWorkboardMoves<T extends NavEngagement>(
  engagements: readonly T[],
  rows: readonly ContainerRow[],
  pending: PendingMoves,
): T[] {
  return engagements.map((engagement) => {
    const key = `workboard:${engagement.id}`;
    if (!(key in pending)) return engagement;
    const to = pending[key] ?? null;
    const row = to ? rows.find((r) => r.id === to) : undefined;
    return {
      ...engagement,
      clients: row
        ? { id: row.id, name: row.name, quick_folder: false, kind: row.kind, parent_id: row.parent_id }
        : null,
    };
  });
}

export type DropCalls = {
  reparent: (input: { clientId: string; parentId: string | null }) => Promise<void>;
  moveWorkboard: (input: { engagementId: string; clientId: string | null }) => Promise<void>;
  log: (event: "container.reparented" | "engagement.updated", dims: Record<string, string | number>) => void;
};

/**
 * Optimistic move, then reconcile. Shows the move at once, performs the one
 * proven call, and puts it back if refused, handing the database's own words
 * to `onRefused`. A refusal fires no event.
 */
export async function performDrop(args: {
  item: DragItem;
  target: DropTarget;
  rows: readonly ContainerRow[];
  calls: DropCalls;
  setPending: (update: (prev: PendingMoves) => PendingMoves) => void;
  onRefused: (message: string) => void;
  onSettled?: () => void | Promise<void>;
}): Promise<boolean> {
  const { item, target, rows, calls, setPending, onRefused } = args;
  if (!canDropOn(rows, item, target)) return false;
  const to = destinationOf(target);
  const key = moveKey(item);
  setPending((prev) => ({ ...prev, [key]: to }));
  try {
    if (item.type === "container") {
      await calls.reparent({ clientId: item.id, parentId: to });
      calls.log("container.reparented", {
        kind: item.kind,
        depth: to ? containerDepth(rows, to) + 1 : 0,
        action: "drag",
      });
    } else {
      await calls.moveWorkboard({ engagementId: item.id, clientId: to });
      calls.log("engagement.updated", {
        moved: "true",
        to_container: to ? "true" : "false",
        from: "drag",
      });
    }
    await args.onSettled?.();
    setPending((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    return true;
  } catch (e) {
    setPending((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    onRefused((e as Error).message);
    return false;
  }
}
