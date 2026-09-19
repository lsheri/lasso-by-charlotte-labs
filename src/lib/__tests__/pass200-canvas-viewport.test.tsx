import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ZOOM_MAX, ZOOM_MIN, clampZoom, stepZoom, wheelPanDelta, zoomAbout } from "../canvas-zoom";
import { CanvasLabStatusLine } from "@/components/canvas-lab/CanvasLabStatusLine";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/** Where a screen point lands in board coordinates. */
const world = (pan: { x: number; y: number }, zoom: number, point: { x: number; y: number }) => ({
  x: (point.x - pan.x) / zoom,
  y: (point.y - pan.y) / zoom,
});

describe("pass 200 — viewport gestures", () => {
  it("keeps the point under the cursor fixed across three zoom steps", () => {
    const cursor = { x: 420, y: 260 };
    let pan = { x: -120, y: 40 };
    let zoom = 0.8;
    const before = world(pan, zoom, cursor);
    for (const next of [0.9, 1.1, 1.4]) {
      pan = zoomAbout(pan, zoom, next, cursor);
      zoom = clampZoom(next);
      const after = world(pan, zoom, cursor);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    }
  });

  it("stays consistent when the zoom clamps at either end", () => {
    const cursor = { x: 100, y: 100 };
    const pan = { x: 10, y: 10 };
    expect(zoomAbout(pan, 1, 9, cursor)).toEqual(zoomAbout(pan, 1, ZOOM_MAX, cursor));
    expect(zoomAbout(pan, 1, 0.01, cursor)).toEqual(zoomAbout(pan, 1, ZOOM_MIN, cursor));
    expect(zoomAbout(pan, 1, 1, cursor)).toEqual(pan);
  });

  it("reads wheel deltas in pixels and in lines", () => {
    expect(wheelPanDelta({ deltaX: 12, deltaY: -30, deltaMode: 0 })).toEqual({ x: 12, y: -30 });
    expect(wheelPanDelta({ deltaX: 1, deltaY: -2, deltaMode: 1 })).toEqual({ x: 16, y: -32 });
    expect(wheelPanDelta({ deltaX: 0, deltaY: 1, deltaMode: 2 })).toEqual({ x: 0, y: 100 });
    expect(wheelPanDelta({ deltaX: 4, deltaY: 4 })).toEqual({ x: 4, y: 4 });
  });

  it("leaves the existing exports alone", () => {
    expect(stepZoom(1, "in")).toBeCloseTo(1.1, 6);
    expect(clampZoom(1)).toBe(1);
  });

  it("the workboard pans on a plain wheel and zooms about the cursor", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("wheelPanDelta");
    expect(page).toContain("zoomAbout");
    expect(page).toContain("scrollableUnder(target, shell!, delta)");
    expect(page).toContain('addEventListener("wheel", onSurfaceWheel, { passive: false })');
    expect(page).toContain("zoomAtCentre(1)");
    expect(page).toContain("spaceRef.current) return; // Space pans the board");
  });

  it("keeps native Space activation for focused controls", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("active !== document.body && active !== shell && active !== stage");
    expect(page).not.toContain("active?.closest(\"textarea,input,[contenteditable='true'],[role='menu'],[data-testid^='lab-card-']\")");
  });

  it("renders only the reading line while the Workboard reads are pending", () => {
    const html = renderToStaticMarkup(<CanvasLabStatusLine loading unavailable empty />);
    expect(html).toContain("reading the engagement");
    expect(html).not.toContain("nothing is on this workboard yet");
    expect(html).not.toContain("This workboard could not be opened.");
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("const loadingBoard = isLoading || lab.boardLoading");
    expect(page).toContain('{boardReady ? <div data-testid="canvas-lab-stage"');
    expect(page).toContain("loading={loadingBoard}");
    expect(page).toContain("empty={boardReady && visibleNodes.length === 0}");
  });
});
