/**
 * ATTACH-1: the Add work list groups a chat with the pieces it made, using
 * the board's own bundle rule (bundlePiecesByChat), and ticking a chat picks
 * its pieces with it. Pure logic only; the component stays thin.
 */
import { bundlePiecesByChat, type BundleItem } from "@/components/canvas-lab/canvas-lab-model";

export type OrderedRow<T> = {
  item: T;
  /** Set when this row is a piece docked under a chat that is also in the list. */
  chatId: string | null;
};

/**
 * The rendered order: every top-level row in list order, each chat followed
 * immediately by its own pieces in bundle order. A piece whose chat is not in
 * the list stays a normal top-level row; nothing disappears.
 */
export function orderWithBundles<T extends BundleItem>(items: readonly T[]): OrderedRow<T>[] {
  const bundles = bundlePiecesByChat(items);
  const nested = new Set<string>();
  for (const pieceIds of bundles.values()) for (const id of pieceIds) nested.add(id);
  const rows: OrderedRow<T>[] = [];
  for (const item of items) {
    if (nested.has(item.id)) continue;
    rows.push({ item, chatId: null });
    for (const pieceId of bundles.get(item.id) ?? []) {
      const piece = items.find((candidate) => candidate.id === pieceId);
      if (piece) rows.push({ item: piece, chatId: item.id });
    }
  }
  return rows;
}

/**
 * Ticking a chat selects it and every piece in its bundle; unticking clears
 * them all. A piece toggles alone (pass an empty pieces list). Selection never
 * infers upward: picking every piece does not tick the chat.
 */
export function toggleWithPieces(
  picked: ReadonlySet<string>,
  id: string,
  pieces: readonly string[],
): Set<string> {
  const next = new Set(picked);
  if (next.has(id)) {
    next.delete(id);
    for (const pieceId of pieces) next.delete(pieceId);
  } else {
    next.add(id);
    for (const pieceId of pieces) next.add(pieceId);
  }
  return next;
}
