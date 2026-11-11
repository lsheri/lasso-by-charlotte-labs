import { useEffect, useRef } from "react";

/**
 * S4b-2: a notification opens the board, then the piece of work in the one view, on its Stickies tab, with
 * the sticky open on its spot. The board page wires this in; the choice of what to open lives here so it
 * can be tested without rendering the board.
 */

export type StickyTarget = { stickyId: string; workItemId: string; at: number };

export const STICKY_LINK_COPY = {
  gone: "That sticky's work is no longer on this board.",
} as const;

type PieceLike = { id: string; kind: string; workItemId?: string | null | undefined };
type ItemLike = { id: string };

/** The piece showing that work, once it and its work have loaded; "wait" while they load; "gone" if absent. */
export function findStickyPiece<N extends PieceLike, I extends ItemLike>(
  nodes: readonly N[] | null,
  items: readonly I[],
  pendingIds: ReadonlySet<string> | readonly string[],
  workItemId: string,
): { node: N; item: I } | "wait" | "gone" {
  if (!nodes) return "wait";
  const node = nodes.find((one) => one.workItemId === workItemId && one.kind !== "answer");
  if (!node) return "gone";
  const item = items.find((one) => one.id === workItemId);
  if (item) return { node, item };
  const pending = Array.isArray(pendingIds) ? pendingIds.includes(workItemId) : (pendingIds as ReadonlySet<string>).has(workItemId);
  return pending ? "wait" : "gone";
}

/** Opens each target once. A new notification click (a new `at`) opens again, even for the same sticky. */
export function useStickyDeepLink<N extends PieceLike, I extends ItemLike>({
  target,
  nodes,
  items,
  pendingIds,
  open,
  gone,
}: {
  target: StickyTarget | null | undefined;
  nodes: readonly N[] | null;
  items: readonly I[];
  pendingIds: ReadonlySet<string> | readonly string[];
  open: (node: N, item: I, stickyId: string) => void;
  gone: () => void;
}): void {
  const handled = useRef<number | null>(null);
  const openRef = useRef(open);
  const goneRef = useRef(gone);
  openRef.current = open;
  goneRef.current = gone;
  useEffect(() => {
    if (!target || handled.current === target.at) return;
    const found = findStickyPiece(nodes, items, pendingIds, target.workItemId);
    if (found === "wait") return;
    handled.current = target.at;
    if (found === "gone") goneRef.current();
    else openRef.current(found.node, found.item, target.stickyId);
  }, [target, nodes, items, pendingIds]);
}
