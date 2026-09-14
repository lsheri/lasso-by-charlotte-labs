import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("pass 154 shared surfaces", () => {
  it("lags one travelling rule without changing reduced motion", () => {
    const page = read("src/pages/EngagementPage.tsx");
    expect(page).toContain("[transition-duration:420ms]");
    expect(page).toContain("motion-reduce:transition-none");
    expect(page.match(/<GraphiteRule className="text-\[var\(--nb-green\)\]"/g)).toHaveLength(1);
  });

  it("keeps Work Artifact on Share with the existing handler and a drawing spider", () => {
    const page = read("src/pages/EngagementPage.tsx");
    const share = read("src/components/engagements/SharedWithSection.tsx");
    const action = read("src/components/engagements/CanvasDeliverableActions.tsx");
    expect(page).not.toMatch(/const headerAction[\s\S]*?<CanvasDeliverableActions/);
    expect(page).toMatch(/view === "share"[\s\S]*?<CanvasDeliverableActions/);
    expect(share).toContain("SEND TO THE FIRM");
    expect(share).toContain("<CanvasDeliverableActions");
    expect(action).toContain("openJourney({ anchorId: anchor.id, anchorTitle: anchor.title, engagementId })");
    expect(action).toContain("<SpiderDrawing");
  });

  it("gives tasks their own sidebar depth", () => {
    expect(read("src/components/layout/SidebarNav.tsx")).toContain("nb-nav-item-nested-3");
    expect(read("src/styles.css")).toMatch(/\.nb-nav-item-nested-3 \{\s*padding-left: 52px;/);
  });

  it("uses paper notes for linked sources and question history", () => {
    const ledger = read("src/components/engagements/WorkLedger.tsx");
    const coaching = read("src/components/coaching/SubjectCoachingSection.tsx");
    expect(ledger).toContain('<WorkNote item={item} onOpen={() => onOpen(item)} />');
    expect(coaching).toContain("Questions asked here");
    expect(coaching).toContain("A record of what was asked here, newest first.");
    expect(coaching).toContain('"--nb-paper-fill": "var(--paper-5)"');
  });
});