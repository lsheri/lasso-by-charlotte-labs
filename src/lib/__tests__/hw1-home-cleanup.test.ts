import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("H-W1 home cleanup", () => {
  it("Home no longer mounts the welcome board", () => {
    const home = read("src/pages/HomePage.tsx");
    expect(home).not.toContain("WelcomeBoard");
    expect(home).not.toContain("A guide from Lasso");
  });
  it("the retired Getting Started card no longer exists", () => {
    expect(existsSync("src/components/onboarding/checklist/GettingStartedCard.tsx")).toBe(false);
  });
  it("signed-in Home passes onOpen and the card is a Link to the board page", () => {
    expect(read("src/components/home/HomeBoard.tsx")).toMatch(/<HomeEngagementGrid[\s\S]*?onOpen=/);
    const grid = read("src/components/home/HomeEngagementGrid.tsx");
    expect(grid).toContain('to="/engagements/$id/canvas-lab"');
    expect(grid).toContain("onPointerDown={onOpen ?");
  });
  it("the public demo does not pass the new prop", () => {
    expect(read("src/components/demo/DemoHomeWorkspace.tsx")).not.toContain("onOpen=");
  });
  it("the retired Getting Started walkthrough files no longer exist", () => {
    for (const file of [
      "src/components/onboarding/checklist/WelcomeCard.tsx",
      "src/components/onboarding/checklist/ChecklistStep.tsx",
      "src/components/onboarding/checklist/steps.ts",
      "src/components/onboarding/checklist/ChecklistLauncher.tsx",
      "src/components/onboarding/checklist/LauncherPill.tsx",
      "src/components/onboarding/checklist/StepPopover.tsx",
      "src/components/onboarding/ProgressDots.tsx",
    ]) {
      expect(existsSync(file)).toBe(false);
    }
  });
});
