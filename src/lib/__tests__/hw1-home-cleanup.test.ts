import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("H-W1 home cleanup", () => {
  it("Home no longer mounts the welcome board", () => {
    const home = read("src/pages/HomePage.tsx");
    expect(home).not.toContain("WelcomeBoard");
    expect(home).not.toContain("A guide from Lasso");
  });
  it("Work no longer mounts the Getting Started card", () => {
    expect(read("src/pages/WorkPage.tsx")).not.toContain("GettingStartedCard");
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
  it("signed-in chrome no longer mounts the Getting Started walkthrough", () => {
    for (const file of [
      "src/components/layout/AppSidebar.tsx",
      "src/components/layout/MobileTabBar.tsx",
      "src/components/layout/AppShell.tsx",
    ]) {
      expect(read(file)).not.toContain("onboarding/checklist");
    }
  });
});
