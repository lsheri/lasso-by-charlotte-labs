/**
 * The engagement canvas, as pure moves.
 *
 * Every gesture (pointer, keyboard, menu) resolves to the same two things: a
 * position and a move between positions. Keeping that here means the keyboard
 * path and the drag path can never drift apart, and both are testable without
 * a browser.
 */

export type CanvasPos = { col: number; index: number };

/** A column reduced to what a move needs: which cards it holds, in order. */
export type MoveColumn = { id: string; name: string; cardIds: string[] };

export function samePos(a: CanvasPos, b: CanvasPos): boolean {
  return a.col === b.col && a.index === b.index;
}

/** Splice out of `from`, insert at a clamped `to`. Returns new columns. */
export function moveCard(
  cols: MoveColumn[],
  from: CanvasPos,
  to: CanvasPos,
): { cols: MoveColumn[]; pos: CanvasPos } {
  const source = cols[from.col];
  const target = cols[to.col];
  if (!source || !target) return { cols, pos: from };
  const moved = source.cardIds[from.index];
  if (moved === undefined) return { cols, pos: from };

  const next = cols.map((col) => ({ ...col, cardIds: [...col.cardIds] }));
  next[from.col]!.cardIds.splice(from.index, 1);
  const limit = next[to.col]!.cardIds.length;
  const index = Math.max(0, Math.min(to.index, limit));
  next[to.col]!.cardIds.splice(index, 0, moved);
  return { cols: next, pos: { col: to.col, index } };
}

/**
 * Where a pointer at `y` wants to insert, by card midpoint. `midpoints` are the
 * vertical centres of the cards already in the target column, top to bottom.
 */
export function indexByMidpoint(midpoints: number[], y: number): number {
  let index = 0;
  for (const mid of midpoints) {
    if (y > mid) index += 1;
    else break;
  }
  return index;
}

/** A drop inside the source column has to account for the card leaving first. */
export function correctSameColumn(from: CanvasPos, to: CanvasPos): CanvasPos {
  if (from.col !== to.col) return to;
  if (to.index > from.index) return { col: to.col, index: to.index - 1 };
  return to;
}

/** Arrow keys, resolved against the shape of the board. */
export function keyboardTarget(
  cols: MoveColumn[],
  pos: CanvasPos,
  key: string,
): CanvasPos | null {
  const current = cols[pos.col];
  if (!current) return null;
  if (key === "ArrowUp") {
    return pos.index > 0 ? { col: pos.col, index: pos.index - 1 } : null;
  }
  if (key === "ArrowDown") {
    return pos.index < current.cardIds.length - 1 ? { col: pos.col, index: pos.index + 1 } : null;
  }
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const col = key === "ArrowLeft" ? pos.col - 1 : pos.col + 1;
    const target = cols[col];
    if (!target) return null;
    return { col, index: Math.min(pos.index, target.cardIds.length) };
  }
  return null;
}

/** What the live region says. Plain sentences, never coordinates. */
export function announceGrab(title: string): string {
  return `${title} picked up`;
}
export function announceMove(title: string, columnName: string, index: number): string {
  return `${title} moved to ${columnName}, position ${index + 1}`;
}
export function announceDrop(title: string): string {
  return `${title} dropped`;
}
export function announceCancel(title: string): string {
  return `${title} returned to where it was`;
}
