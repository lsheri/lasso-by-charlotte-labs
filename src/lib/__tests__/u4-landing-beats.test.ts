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

  it("uses a six-slide illustrative Harborline deck and real vendor marks", () => {
    expect(hero).toContain("Illustrative client recommendation");
    expect(hero).toContain("Harborline Health Alliance · Growth partnerships and board structure, FY27");
    expect(hero).toContain("Bridge4 Partners · illustrative · {index + 1} / 6");
    expect(hero).toContain("Slide {current.slide + 1} of 6");
    expect(hero).toContain("Five organizations we benchmarked.");
    expect(hero).toContain("Partnership revenue to $1.4M by FY27.");
    expect(hero).toContain("<VendorMark");
    expect(hero).not.toContain("Riverside Nine");
  });

  it("moves branded conversation excerpts along one path per step", () => {
    expect(hero).toContain("ConversationTunnel");
    expect(hero).not.toContain("landing-story-vortex-rings");
    expect(hero).toContain("landing-story-fragment");
    expect(hero.match(/<SourceGlyph/g)?.length).toBeGreaterThanOrEqual(2);
    expect(hero).toContain('vendor: "granola"');
    expect(hero).toContain('vendor: "lovable"');
    expect(hero).toContain("landing-story-doodle");
    expect(hero).toContain("landing-story-reach-chip");
  });

  it("makes each incoming question and Lasso answer explicit", () => {
    expect(hero).toContain("Client question");
    expect(hero).toContain("Manager question");
    expect(hero).toContain("Lasso answers");
    expect(hero).toContain("landing-story-response");
    expect(page.match(/HOW IT WORKS/g)).toHaveLength(1);
  });
});

describe("Unit 8 story system", () => {
  it("has four steps opening slides 2, 1, 3, 5", () => {
    const slides = Array.from(hero.matchAll(/^    slide: (\d),$/gm), (m) => Number(m[1]));
    expect(slides).toEqual([2, 1, 3, 5]);
    expect(hero).toContain("Open the exact turn · 1");
  });

  it("closes with the pilot line and an invisible-ink layer", () => {
    expect(page).toContain("Three months");
    expect(page).toContain("The work, judgment, thinking. Visible.");
    expect(page).toContain("landing-close-wordmark");
    expect(page).toContain("landing-close-particles");
    expect(page).not.toContain("ParticleReveal");
    expect(page).toContain('notePlacedPilotClick("header")');
    expect(page).toContain('notePlacedPilotClick("close")');
    expect(page).toContain("dims: { placement }");
  });
});

describe("Unit 8 placement dim", () => {
  it("keeps placement on the pilot CTA event", async () => {
    const { guardEventDims } = await import("@/lib/event-dim-allowlist");
    const kept = guardEventDims("landing.pilot_cta_clicked", { placement: "header" }) as Record<string, unknown>;
    expect(kept).toMatchObject({ keep: true, dims: { placement: "header" } });
  });
});
