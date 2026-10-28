import { describe, expect, it } from "vitest";

import { TOOLBAR_GAP, planToolbarOverflow, type ToolbarControlSpec } from "@/lib/toolbar-overflow";

const CONTROLS: ToolbarControlSpec[] = [
  { id: "workstreams", width: 170, moveOrder: 1 },
  { id: "display", width: 140, moveOrder: 2 },
  { id: "region-fill", width: 120, moveOrder: 3 },
  { id: "add-text", width: 86, moveOrder: 4 },
  { id: "region", width: 78, moveOrder: 5 },
  { id: "details", width: 72, moveOrder: 6 },
  { id: "fit", width: 48, moveOrder: 7 },
  { id: "add-work", width: 92, pinned: true },
  { id: "ask", width: 96, pinned: true },
  { id: "zoom", width: 110, pinned: true },
];

const total = (ids: string[]) => ids.slice().sort();

describe("board toolbar overflow", () => {
  it("budgets creation and board controls independently at desktop and phone widths", () => {
    const floating: ToolbarControlSpec[] = [
      { id: "add-work", width: 106, pinned: true, group: 1 },
      { id: "add-text", width: 40, moveOrder: 5, group: 2 },
      { id: "add-sticky", width: 40, moveOrder: 6, group: 2 },
      { id: "region", width: 40, moveOrder: 9, group: 3 },
      { id: "section", width: 40, moveOrder: 10, group: 3 },
      { id: "suggest", width: 40, moveOrder: 7, group: 3 },
    ];
    const header = CONTROLS.filter((control) => ["workstreams", "details", "fit", "ask", "zoom"].includes(control.id));
    expect(planToolbarOverflow(1186, floating).overflow).toEqual([]);
    expect(planToolbarOverflow(296, floating)).toEqual({ row: ["add-work", "region", "section"], overflow: ["add-text", "add-sticky", "suggest"] });
    const headerBefore = planToolbarOverflow(760, header);
    planToolbarOverflow(100, floating);
    expect(planToolbarOverflow(760, header)).toEqual(headerBefore);
    expect(planToolbarOverflow(1186, floating)).toEqual({ row: floating.map((control) => control.id), overflow: [] });
  });
  it("places every control either in the row or in the overflow, at any width", () => {
    const everything = total(CONTROLS.map((control) => control.id));
    for (const available of [0, 120, 300, 520, 760, 1041, 2000]) {
      const plan = planToolbarOverflow(available, CONTROLS);
      expect(total([...plan.row, ...plan.overflow])).toEqual(everything);
      expect(plan.row.filter((id) => plan.overflow.includes(id))).toEqual([]);
    }
  });

  it("keeps the pinned controls in the row however narrow the container is", () => {
    const pinned = CONTROLS.filter((control) => control.pinned).map((control) => control.id);
    for (const available of [0, 100, 400, 750]) {
      const plan = planToolbarOverflow(available, CONTROLS);
      for (const id of pinned) expect(plan.row).toContain(id);
    }
  });

  it("moves nothing when the row fits and moves in moveOrder order when it does not", () => {
    const widths = CONTROLS.map((control) => control.width);
    const roomy = widths.reduce((sum, width) => sum + width, 0) + TOOLBAR_GAP * (widths.length - 1);
    expect(planToolbarOverflow(roomy, CONTROLS).overflow).toEqual([]);

    const tight = planToolbarOverflow(roomy - 200, CONTROLS);
    const order = tight.overflow.map((id) => CONTROLS.find((control) => control.id === id)?.moveOrder ?? 0);
    expect(order).toEqual(order.slice().sort((a, b) => a - b));
    expect(tight.overflow.length).toBeGreaterThan(0);
  });
});
