// Phase 4 (option B): the first-run tour is off for everyone until it is rewritten for the flip.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FIRST_RUN_TOUR_ON } from "@/lib/first-run-tour";

const route = readFileSync("src/routes/onboarding.tsx", "utf8");

describe("first-run tour switch", () => {
  it("ships switched off", () => {
    expect(FIRST_RUN_TOUR_ON).toBe(false);
  });

  it("gates only the step after setup, so finishing setup lands on Home", () => {
    const finish = route.slice(route.indexOf("async function finish()"), route.indexOf("function completeTour()"));
    expect(finish).toContain("if (!setup && FIRST_RUN_TOUR_ON) {");
    expect(finish).toContain("land();");
  });

  it("keeps the tour itself in place for the rewrite", () => {
    expect(route).toContain("<OnboardingTour");
    expect(readFileSync("src/components/marketing/LandingBoard.tsx", "utf8")).toContain("<OnboardingTour");
  });
});
