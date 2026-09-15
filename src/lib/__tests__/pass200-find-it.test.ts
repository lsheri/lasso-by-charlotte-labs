import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MOTION_SCENES } from "@/lib/motion-scenes";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("pass 200 - Find it", () => {
  it("carries telemetry now that the page does real work", () => {
    const source = read("src/pages/FindItPage.tsx");
    expect(source).toContain("logEvent");
    expect(source).toContain("@/lib/telemetry");
  });

  it("keeps the shimmer and its route free of telemetry", () => {
    for (const file of [
      "src/components/motion/ChatShimmer.tsx",
      "src/routes/_authenticated/find-it.tsx",
    ]) {
      expect(read(file)).not.toContain("logEvent");
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
