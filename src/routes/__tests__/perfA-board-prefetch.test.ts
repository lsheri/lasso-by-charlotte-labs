import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canvasLabBoardQuery } from "@/hooks/use-canvas-lab";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("PERF-A board read starts before the redirect", () => {
  const detail = read("routes/_authenticated/engagements.$id.tsx");
  const lab = read("routes/_authenticated/engagements.$id_.canvas-lab.tsx");

  it("shares one cache key with useCanvasLab", () => {
    expect(canvasLabBoardQuery("e1", "p1").queryKey).toEqual(["canvas-lab-board", "e1", "p1"]);
  });

  it("prefetches the board, unawaited, before useEngagementPage in the detail route", () => {
    const prefetch = detail.indexOf("void queryClient.prefetchQuery(canvasLabBoardQuery(id, profileId))");
    const pageRead = detail.indexOf("useEngagementPage(id)");
    expect(prefetch).toBeGreaterThan(-1);
    expect(prefetch).toBeLessThan(pageRead);
    expect(detail).not.toMatch(/await\s+queryClient\.prefetchQuery/);
  });

  it("preloads the canvas-lab route code on mount, unawaited", () => {
    expect(detail).toContain('void router.preloadRoute({ to: "/engagements/$id/canvas-lab", params: { id } })');
    expect(detail.indexOf("router.preloadRoute")).toBeLessThan(detail.indexOf("useEngagementPage(id)"));
  });

  it("prefetches on direct canvas-lab opens without awaiting", () => {
    expect(lab).toContain("void queryClient.prefetchQuery(canvasLabBoardQuery(id, profileId))");
    expect(lab).not.toMatch(/await\s+queryClient\.prefetchQuery/);
  });
});
