import { describe, expect, it } from "vitest";

import { TOOLBAR_GAP, planToolbarOverflow, type ToolbarControlSpec } from "@/lib/toolbar-overflow";

const CONTROLS: ToolbarControlSpec[] = [
  { id: "suggest", width: 170, moveOrder: 1 },
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
  it("budgets all four groups together without losing menu-less controls", () => {
    // TOOLBAR-8: declared widths match the rendered ones at each viewport.
    const controlsAt = (phone: boolean): ToolbarControlSpec[] => [
      ...(phone ? [] : [{ id: "board-identity", width: 200, pinned: true, group: 0 }]),
      { id: "add-work", width: phone ? 36 : 106, pinned: true, group: 1 },
      ...["add-text", "add-sticky", "region", "section", "suggest"].map((id, i) => ({ id, width: 36, moveOrder: [5, 6, 9, 10, 7][i] ?? 7, group: 2 })),
      { id: "fit", width: 36, moveOrder: 2, group: 3 },
      phone ? { id: "zoom", width: 124, moveOrder: 0, group: 3 } : { id: "zoom", width: 124, pinned: true, group: 3 },
      { id: "card-face", width: 68, group: 3 },
      { id: "working-from", width: phone ? 36 : 0, pinned: true, group: 4 },
      { id: "ask", width: phone ? 36 : 124, pinned: true, group: 4 },
      { id: "share", width: 36, pinned: true, group: 4 },
      { id: "details", width: 36, moveOrder: 3, group: 4 },
    ];
    const desk = controlsAt(false);
    expect(planToolbarOverflow(1186, desk).overflow).toEqual([]);
    for (const budget of [798, 930, 1058, 1186]) {
      const plan = planToolbarOverflow(budget, desk);
      expect(plan.row).toContain("board-identity");
      expect(plan.row).toContain("add-work");
      expect(plan.row).toContain("ask");
      expect([...plan.row, ...plan.overflow].sort()).toEqual(desk.map((control) => control.id).sort());
    }
    const controls = controlsAt(true);
    const phone = planToolbarOverflow(296, controls);
    expect(phone.row).toEqual(["add-work", "working-from", "ask", "share"]);
    expect(phone.overflow).toEqual(["zoom", "fit", "details", "add-text", "add-sticky", "suggest", "region", "section", "card-face"]);
    expect([...phone.row, ...phone.overflow].sort()).toEqual(controls.map((control) => control.id).sort());
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
