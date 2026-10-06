import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS } from "../event-dim-allowlist";

/** Styles left behind by the superseded T1 to T3 first-run tour acts. */
const DELETED_CLASSES = [
  "tour-ambient-column", "tour-ambient-frame", "tour-ambient-link", "tour-ambient-node",
  "tour-arrival-board", "tour-artifact-card", "tour-ask-act", "tour-ask-board-scene",
  "tour-card-hint", "tour-card-source", "tour-card-wrap", "tour-coming-act",
  "tour-drawn-preview", "tour-file-glyph", "tour-final-images", "tour-first-image",
  "tour-free-node", "tour-group-act", "tour-group-scope", "tour-image-card",
  "tour-keep-act", "tour-keep-board", "tour-keep-source", "tour-primary-frame",
  "tour-source-frame", "tour-source-mini", "tour-hint-fade",
];

function grep(term: string): string {
  return execSync(`grep -rnF -e "${term}" src tests --exclude=tv6-old-tour-removed.test.ts || true`, { encoding: "utf8" })
    .split("\n")
    // A class name that is a prefix of a live one (tour-source-frame vs tour-source-frame-title) is matched exactly below.
    .filter((line) => line.trim() !== "")
    .join("\n");
}

describe("TV6 the superseded first-run tour is gone", () => {
  it.each(DELETED_CLASSES)("%s has zero references", (name) => {
    const hits = grep(name).split("\n").filter((l) => l && new RegExp(`${name}(?![\\w-])`).test(l));
    expect(hits).toEqual([]);
  });

  it("/onboarding still renders the eight-act tour", () => {
    expect(readFileSync("src/routes/onboarding.tsx", "utf8")).toContain("<OnboardingTour");
    const tour = readFileSync("src/components/onboarding/OnboardingTour.tsx", "utf8");
    expect(tour).toContain("<TourStage");
    expect(tour).toContain("useTourActRenderers");
  });

  it("the five tour.* events still exist", () => {
    expect(Object.keys(EVENT_DIM_KEYS).filter((k) => k.startsWith("tour.")).sort()).toEqual(
      ["tour.finished", "tour.skipped", "tour.started", "tour.step_continued", "tour.step_done"],
    );
  });
});
