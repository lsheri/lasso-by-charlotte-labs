import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const hero = readFileSync("src/components/marketing/HeroMotion.tsx", "utf8");
const beats = readFileSync("src/components/marketing/BeatSnapshots.tsx", "utf8");

function visibleCopy(src: string) {
  return src
    .replace(/^import .*$/gm, "")
    .replace(/className=(?:"[^"]*"|\{`[^`]*`\})/g, "")
    .replace(/\/\/.*$/gm, "")
    .toLowerCase();
}

describe("Unit 4 public page", () => {
  it("keeps the four original anonymous events and adds the story-section event", () => {
    for (const name of ["landing.viewed", "landing.pilot_cta_clicked", "landing.see_it_work_clicked", "landing.pilot_requested", "landing.story_section_viewed"]) {
      expect(page).toContain(`event_type: "${name}"`);
    }
    expect(page).toContain('dims: { variant: "b2b", surface }');
    expect(page).toContain("dims: { team_size: teamSize }");
  });

  it("carries the hero H1 and the beats anchor", () => {
    expect(page).toContain("Your firm bought AI. The human judgment, process, and thinking in your team's work went invisible.");
    expect(page).toContain('href="#beats"');
    expect(page).toContain('id="beats"');
  });

  it("has no em dash and no banned words", () => {
    for (const src of [page, hero, beats]) {
      expect(src).not.toContain("\u2014");
      const copy = visibleCopy(src);
      for (const word of ["track", "monitor", "watch", "caught", "score", "surveillance", "telemetry", "analytics", "data collection", "oversight", "governance", "compliance"]) {
        expect(copy).not.toMatch(new RegExp(`\\b${word}`, "i"));
      }
    }
  });

  it("animates with CSS only", () => {
    expect(hero).not.toContain("requestAnimationFrame");
    expect(beats).not.toContain("requestAnimationFrame");
    expect(hero).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(beats).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("uses a four-slide illustrative deck and real vendor marks", () => {
    expect(hero).toContain("Illustrative client recommendation");
    expect(hero).toContain("Illustrative comparison, not customer results");
    expect(hero).toContain("<VendorMark");
    expect(hero).toContain("Find the link to the Claude conversation where I said ‘xyz’.");
    expect(hero).not.toContain("Riverside Nine");
  });

  it("makes each incoming question and Lasso answer explicit", () => {
    expect(hero).toContain("Client question");
    expect(hero).toContain("Manager question");
    expect(hero).toContain("Lasso answers");
    expect(hero).toContain("landing-story-response");
    expect(page.match(/HOW IT WORKS/g)).toHaveLength(2);
  });
});
