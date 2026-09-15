import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveMotion } from "@/lib/motion-registry";

const read = (p: string) => readFileSync(p, "utf8");

describe("pass B: where a call gets settled", () => {
  it("stamps the surface on confirm, discard and edit", () => {
    const src = read("src/hooks/use-decision-actions.ts");
    expect(src).toContain('export type DecisionSurface = "inbox" | "log" | "engagement"');
    expect(src).toContain("{ edited, evidence_count: 0, surface }");
    expect(src).toContain('logV2("decision.discarded", { edited, surface }');
    expect(src).toContain('logV2("decision.edited", { edited, surface }');
  });

  it("keeps the surface vocabulary closed and additive", () => {
    const schemas = read("src/lib/telemetry-v2.server.ts");
    expect(schemas).toContain('const DECISION_SURFACE = z.enum(["inbox", "log", "engagement"])');
    expect(schemas).toContain("surface: DECISION_SURFACE.optional()");
  });

  it("names the surface at each host", () => {
    expect(read("src/components/overview/WaitingOnYou.tsx")).toContain(
      'useDecisionActions("inbox")',
    );
    expect(read("src/components/decisions/EngagementDecisions.tsx")).toContain(
      'useDecisionActions("engagement")',
    );
    expect(read("src/pages/DecisionsPage.tsx")).toContain('surface: "log"');
  });
});

describe("pass B: the two motion events", () => {
  it("resolves both, with a reduced answer that still says it", () => {
    const confirmed = resolveMotion("decision.confirmed", false);
    expect(confirmed.className).toBe("nb-call-settle");
    expect(resolveMotion("decision.confirmed", true).className).toBe("");
    expect(resolveMotion("decision.confirmed", true).reduced.length).toBeGreaterThan(0);

    const label = resolveMotion("decision.on_record_shown", false);
    expect(label.className).toBe("nb-record-label");
    expect(resolveMotion("decision.on_record_shown", true).reduced.length).toBeGreaterThan(0);
  });

  it("leaves the five auditability events promised", () => {
    for (const event of [
      "record.reading",
      "verify.reading",
      "verify.flagged",
      "provenance.tracing",
      "provenance.shown",
    ] as const) {
      expect(resolveMotion(event, false).promise).toBe(true);
    }
  });
});

describe("pass B: the surfaces keep their controls", () => {
  it("keeps confirm, discard, the source chip and the note on the inbox strip", () => {
    const src = read("src/components/overview/WaitingOnYou.tsx");
    expect(src).toContain("Calls waiting on you");
    expect(src).toContain("Confirm this call");
    expect(src).toContain("Not a decision");
    expect(src).toContain("Review all");
    expect(src).toContain("Nothing goes on the record until you say so.");
    expect(src).toContain("ThreadViewerById");
  });

  it("keeps the manual trigger and the rail on the log", () => {
    const src = read("src/pages/DecisionsPage.tsx");
    expect(src).toContain("Log a decision");
    expect(src).toContain("AddDecisionDialog");
    expect(src).toContain("Save the reasoning");
    expect(src).toContain("Why was this the right call? A sentence is enough.");
    expect(src).toContain("WHY THE LOG EXISTS");
    expect(src).toContain("Everything");
    expect(src).toContain("Awaiting your review");
    expect(src).toContain("Needs reasoning");
    expect(src).toContain('italicWord="calls"');
  });

  it("names the engagement panel and the 1:1 section", () => {
    expect(read("src/components/decisions/EngagementDecisions.tsx")).toContain(
      "Calls on this engagement",
    );
    const oneToOne = read("src/components/oneonone/ConfirmedCalls.tsx");
    expect(oneToOne).toContain("Calls you confirmed");
    expect(oneToOne).toContain("you confirm once, it travels with the work");
  });

  it("never invents a quote for a source it cannot read", () => {
    const src = read("src/components/decisions/DecisionLogRow.tsx");
    expect(src).toContain("A quote is never invented.");
  });
});
