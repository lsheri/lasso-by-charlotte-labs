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
    const headerAction = page.slice(page.indexOf("const headerAction"), page.indexOf("if (engagementQuery.isPending"));
    expect(headerAction).not.toContain("<CanvasDeliverableActions");
    expect(page).toMatch(/view === "share"[\s\S]*?<CanvasDeliverableActions/);
    expect(share).toContain("SEND TO THE FIRM");
    expect(share).toContain("<CanvasDeliverableActions");
    expect(action).toContain("openJourney({ anchorId: anchor.id, anchorTitle: anchor.title, engagementId })");
    expect(action).not.toContain("<SpiderDrawing");
  });

  // Removed: "gives tasks their own sidebar depth". The nav no longer puts a
  // task at a third depth. A task sits at the same indent as a nested
  // engagement, with "Everything in this engagement" one step in, so there is
  // no behaviour left for this check to describe.



  it("uses paper notes for linked sources and question history", () => {
    const ledger = read("src/components/engagements/WorkLedger.tsx");
    const coaching = read("src/components/coaching/SubjectCoachingSection.tsx");
    expect(ledger).toContain('<WorkNote item={item} onOpen={() => onOpen(item)} />');
    expect(coaching).toContain("Questions asked here");
    expect(coaching).toContain("A record of what was asked here, newest first.");
    expect(coaching).toContain('"--nb-paper-fill": "var(--paper-5)"');
  });
});