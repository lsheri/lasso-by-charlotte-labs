import { describe, expect, it } from "vitest";
import { ASK_DOCK_CONFIG as C, dockBox, dockZoneAt } from "@/lib/ask-dock-engine";

const W = 1200, H = 800;
const F = { x: 240, y: 200 };

describe("ASK-B1 dockBox", () => {
  it("lock_left fills the left edge", () => {
    expect(dockBox("lock_left", W, H, C, 300, F)).toEqual({ x: 12, y: 12, w: 380, h: 772 });
  });
  it("bottom_centre with content 300", () => {
    expect(dockBox("bottom_centre", W, H, C, 300, F)).toEqual({ x: 300, y: 484, w: 600, h: 300 });
  });
  it("tall content caps height", () => {
    expect(dockBox("bottom_centre", W, H, C, 2000, F).h).toBe(Math.min(800 * 0.74, 800 - 16 - 74));
  });
  it("a free y of 0 clamps to the toolbar clearance", () => {
    expect(dockBox("free", W, H, C, 300, { x: 240, y: 0 }).y).toBe(74);
  });
  it("a top inset moves the lock top", () => {
    expect(dockBox("lock_left", W, H, C, 300, F, 40).y).toBe(52);
  });
});

describe("ASK-B1 dockZoneAt", () => {
  it.each([
    [40, 300, "lock_left"], [1160, 300, "lock_right"], [600, 300, null], [600, 740, "bottom_centre"], [1100, 740, "bottom_right"],
  ] as const)("(%i,%i) is %s", (x, y, z) => {
    expect(dockZoneAt({ x, y }, W, H, C)).toBe(z);
  });
  it("a held lock lets go only past the release distance", () => {
    expect(dockZoneAt({ x: 150, y: 300 }, W, H, C, 40, "lock_left")).toBe("lock_left");
    expect(dockZoneAt({ x: 150, y: 300 }, W, H, C, 0, "lock_left")).toBeNull();
  });
});
