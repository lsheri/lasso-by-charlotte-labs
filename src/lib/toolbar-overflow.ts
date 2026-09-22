/**
 * Deciding, without any layout engine, which board toolbar controls stay in
 * the row and which move into the single overflow menu at its end.
 *
 * The rule: a control is either in the row or in the overflow, never in
 * neither and never in both. Pinned controls stay in the row whatever
 * happens, so the person can always close the panel with the same control
 * that opened it.
 */

export type ToolbarControlSpec = {
  id: string;
  /** Roughly what the control measures on its own, in pixels. */
  width: number;
  /** A pinned control is never moved into the overflow. */
  pinned?: boolean;
  /**
   * Lower moves first. Controls with no order given move after the ones that
   * do, in the order they were listed.
   */
  moveOrder?: number;
};

export type ToolbarPlan = {
  row: string[];
  overflow: string[];
};

export const TOOLBAR_OVERFLOW_BUTTON_WIDTH = 36;
export const TOOLBAR_GAP = 8;

function measure(widths: number[], gap: number): number {
  if (widths.length === 0) return 0;
  return widths.reduce((total, width) => total + width, 0) + gap * (widths.length - 1);
}

/**
 * Plan the row for one container width. Controls keep their given order in
 * the row and move into the overflow in moveOrder order, lowest first.
 */
export function planToolbarOverflow(
  available: number,
  controls: ToolbarControlSpec[],
  options?: { gap?: number; overflowWidth?: number },
): ToolbarPlan {
  const gap = options?.gap ?? TOOLBAR_GAP;
  const overflowWidth = options?.overflowWidth ?? TOOLBAR_OVERFLOW_BUTTON_WIDTH;
  const byId = new Map(controls.map((control) => [control.id, control]));
  const inRow = new Set(controls.map((control) => control.id));
  const overflow: string[] = [];

  const movable = controls
    .filter((control) => !control.pinned)
    .map((control, index) => ({ control, index }))
    .sort((a, b) => {
      const left = a.control.moveOrder ?? Number.MAX_SAFE_INTEGER;
      const right = b.control.moveOrder ?? Number.MAX_SAFE_INTEGER;
      return left === right ? a.index - b.index : left - right;
    })
    .map((entry) => entry.control.id);

  const fits = () => {
    const widths = controls.filter((control) => inRow.has(control.id)).map((control) => control.width);
    const extra = overflow.length > 0 ? [overflowWidth] : [];
    return measure([...widths, ...extra], gap) <= available;
  };

  for (const id of movable) {
    if (fits()) break;
    inRow.delete(id);
    overflow.push(id);
  }

  const row = controls.filter((control) => inRow.has(control.id)).map((control) => control.id);
  // Every control is accounted for exactly once, whatever the width.
  const placed = row.length + overflow.length;
  if (placed !== byId.size) throw new Error("toolbar plan lost a control");
  return { row, overflow };
}
