import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findCandidates, scoreChat } from "@/lib/find-it";
import { MOTION_SCENES } from "@/lib/motion-scenes";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const target = { id: "t", title: "Northline pricing model deck", date: "2026-03-10" };

describe("pass 200 - Find it", () => {
  it("scores between 0 and 1 inclusive", () => {
    const scores = [
      scoreChat(target, { id: "a", title: "Northline pricing model deck", date: "2026-03-10" }),
      scoreChat(target, { id: "b", title: "holiday photos", date: null }),
      scoreChat(target, { id: "c", title: "", date: "1999-01-01" }),
    ];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("scores an identical title above an unrelated one", () => {
    const same = scoreChat(target, { id: "a", title: "Northline pricing model deck", date: "2026-03-10" });
    const other = scoreChat(target, { id: "b", title: "holiday photos", date: "2026-03-10" });
    expect(same).toBeGreaterThan(other);
  });

  it("returns candidates strongest first", () => {
    const out = findCandidates(target, [
      { id: "b", title: "holiday photos", date: null },
      { id: "a", title: "Northline pricing model", date: "2026-03-10" },
    ]);
    expect(out[0]?.chatId).toBe("a");
  });

  it("carries no telemetry in the new surfaces", () => {
    for (const file of [
      "src/pages/FindItPage.tsx",
      "src/lib/find-it.ts",
      "src/components/motion/ChatShimmer.tsx",
      "src/routes/_authenticated/find-it.tsx",
    ]) {
      const source = read(file);
      expect(source).not.toContain("logEvent");
      expect(source).not.toContain("@/lib/telemetry");
    }
  });

  it("registers the shimmer scene with a preview", () => {
    expect(MOTION_SCENES.some((scene) => scene.id === "find-it-shimmer")).toBe(true);
    expect(read("src/pages/MotionPage.tsx")).toContain('"find-it-shimmer"');
  });

  it("is reachable from the nav", () => {
    expect(read("src/components/layout/nav-config.ts")).toContain('to: "/find-it"');
  });
});
