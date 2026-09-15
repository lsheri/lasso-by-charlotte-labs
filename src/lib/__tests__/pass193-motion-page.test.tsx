import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { MOTION_SCENES } from "@/lib/motion-scenes";
import { SCENE_VIEWS } from "@/pages/MotionPage";

const PAGE_SRC = readFileSync(join(process.cwd(), "src/pages/MotionPage.tsx"), "utf8");
const NAV_SRC = readFileSync(
  join(process.cwd(), "src/components/layout/nav-config.ts"),
  "utf8",
);

describe("pass 193 — motion review page", () => {
  it("every scene in MOTION_SCENES has a view in SCENE_VIEWS", () => {
    for (const scene of MOTION_SCENES) {
      expect(SCENE_VIEWS[scene.id], `missing view for ${scene.id}`).toBeDefined();
    }
  });

  it("the page has no telemetry", () => {
    expect(PAGE_SRC).not.toContain("@/lib/telemetry");
    expect(PAGE_SRC).not.toContain("logEvent");
  });

  it("nothing links to /motion from the nav", () => {
    expect(NAV_SRC).not.toContain("/motion");
  });
});
