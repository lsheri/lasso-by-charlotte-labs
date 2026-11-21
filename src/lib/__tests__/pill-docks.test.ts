// 21 Nov 2026, chat pill Phase 1c (Liam's recording, corrected the same day): where the pill sits. Pure geometry,
// tested without a browser.
import { describe, expect, it } from "vitest";

import { cornerOf, dockFor, dockKey, dockSpots, nearestDock, PILL_HINTS, pillGeometry, readDock, writeDock, type Viewport } from "@/lib/chat-pill-shared";

const vp = (over: Partial<Viewport> = {}): Viewport => ({ width: 1440, height: 900, phone: false, railWidth: 256, shutWidth: 140, bottomClear: 0, ...over });

describe("the docks", () => {
  it("Home gets three spots (centre, top right, bottom right); other pages the two corners", () => {
    expect(dockSpots(vp(), true).map((s) => s.dock)).toEqual(["center", "top-right", "bottom-right"]);
    expect(dockSpots(vp(), false).map((s) => s.dock)).toEqual(["top-right", "bottom-right"]);
    // The centre sits in the middle of the page beside the menu, never over it.
    const centre = dockSpots(vp(), true)[0]!;
    expect(centre.left).toBeGreaterThanOrEqual(256);
    expect(centre.left + centre.width / 2).toBeCloseTo(256 + (1440 - 256) / 2, 0);
  });
  it("a drop snaps to the nearest spot", () => {
    const spots = dockSpots(vp(), true);
    expect(nearestDock({ x: 1350, y: 40 }, spots)).toBe("top-right");
    expect(nearestDock({ x: 1300, y: 860 }, spots)).toBe("bottom-right");
    expect(nearestDock({ x: 850, y: 470 }, spots)).toBe("center");
    expect(nearestDock({ x: 0, y: 0 }, [])).toBe("bottom-right");
  });
  it("where it sits: the saved choice, centre only on Home, nothing under 640px", () => {
    expect(dockFor(null, "home", 1440)).toBe("center");
    expect(dockFor(null, "proposals", 1440)).toBe("bottom-right");
    expect(dockFor("top-right", "home", 1440)).toBe("top-right");
    expect(dockFor("center", "proposals", 1440)).toBe("bottom-right");
    expect(dockFor("top-right", "home", 390)).toBe("bottom-right");
    expect(cornerOf("center")).toBe("bottom-right");
    expect(cornerOf("top-right")).toBe("top-right");
  });
  it("the corner moves the shut pill and the open panel, never the phone sheet or the full chat", () => {
    expect(pillGeometry("shut", vp({ dock: "top-right" })).top).toBe(24);
    expect(pillGeometry("shut", vp()).top).toBe(900 - 44 - 24);
    expect(pillGeometry("open", vp({ dock: "top-right" })).top).toBe(24);
    expect(pillGeometry("full", vp({ dock: "top-right" }))).toEqual(pillGeometry("full", vp()));
    expect(pillGeometry("open", vp({ phone: true, width: 390, dock: "top-right" }))).toEqual(pillGeometry("open", vp({ phone: true, width: 390 })));
  });
  it("the choice is kept per person in this browser, and a failing store keeps nothing and throws nothing", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    writeDock(storage, "p1", "top-right");
    expect(store.get(dockKey("p1"))).toBe("top-right");
    expect(readDock(storage, "p1")).toBe("top-right");
    expect(readDock(storage, "p2")).toBeNull();
    store.set(dockKey("p1"), "somewhere");
    expect(readDock(storage, "p1")).toBeNull();
    const broken = { getItem: () => { throw new Error("private"); }, setItem: () => { throw new Error("private"); } };
    expect(readDock(broken, "p1")).toBeNull();
    expect(() => writeDock(broken, "p1", "center")).not.toThrow();
  });
  it("each page has its own hint in the question box", () => {
    expect(PILL_HINTS.proposals).toMatch(/proposal/i);
    expect(PILL_HINTS.firm).toMatch(/firm/i);
    expect(new Set(Object.values(PILL_HINTS)).size).toBeGreaterThanOrEqual(4);
  });
});
