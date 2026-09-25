import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
const card = readFileSync("src/components/engagements/ContextCard.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const events = readFileSync("src/lib/telemetry-shared.ts", "utf8");

describe("pass 151 engagement focus", () => {
  it("removes duplicate header surfaces and points work import to the Inbox", () => {
    expect(page).not.toContain("EngagementStrip");
    expect(page).not.toContain("ConnectToWorkSheet");
    expect(page).not.toContain('title="Coaching and sharing"');
    expect(page).toContain("Bring more work in from");
    expect(page).toContain("the Inbox");
  });

  it("keeps engagement actions and the existing Share view", () => {
    expect(page).toContain("Add a wrap-up");
    const headerAction = page.slice(page.indexOf("const headerAction"), page.indexOf("if (engagementQuery.isPending"));
    expect(headerAction).not.toContain("<CanvasDeliverableActions");
    expect(page).toMatch(/view === "share"[\s\S]*?<CanvasDeliverableActions/);
    expect(page).toContain("SharedWithSection");
  });

  it("maps one preferred analysis to every tab with scope-safe fallback", () => {
    expect(page).toContain('brief: "still_on_brief"');
    expect(page).toContain('work: "what_fed_this"');
    expect(page).toContain('verify: "verification"');
    expect(page).toContain('share: "firm_checks"');
    expect(page).toContain('verification: "verification_thread"');
    expect(page).toContain('decision_origin: "decision_origin_thread"');
    expect(page).toContain("availableContextPresets[0]");
  });

  it("records notecard analysis opens without changing existing event names", () => {
    expect(events).toContain('| "engagement.tab_analysis_opened"');
    expect(page).toContain(
      'logEvent("engagement.tab_analysis_opened", profile.org_id, { view, preset });',
    );
    expect(page).toContain("openAnalysis(contextTarget, contextPreset.id, true)");
  });

  it("makes analysis primary and nudges only the Ask arrow", () => {
    expect(card).toContain('bg-[var(--nb-green)]');
    expect(card).toContain('text-[var(--nb-white)]');
    expect(card).toContain('border-[var(--nb-green)]');
    expect(card).toContain('className="nb-ask-arrow"');
    expect(styles).toContain("@keyframes nb-nudge");
    expect(styles).toContain("animation: nb-nudge 4s ease-in-out infinite");
    expect(styles).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.nb-ask-arrow \{ animation: none; \}/);
  });
});