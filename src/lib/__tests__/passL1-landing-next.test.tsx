import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const jsxText = Array.from(route.matchAll(/>([^<{]+)</gs), (match) => match[1]);
const renderedStringProps = Array.from(
  route.matchAll(/(?:aria-label|label|alt|title)="([^"]*)"/g),
  (match) => match[1],
);
const stringLiterals = Array.from(
  route.matchAll(/(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`)/g),
  (match) => match[1] ?? match[2] ?? match[3] ?? "",
);
const renderedCopy = [...jsxText, ...renderedStringProps, ...stringLiterals]
  .join(" ")
  .replace(/\s+/g, " ")
  .toLowerCase();
const requiredReportHeadline = "a note in the margin, not a report on you";
const copyWithoutRequiredHeadline = renderedCopy.replace(requiredReportHeadline, "");

const BANNED = [
  "calls?",
  "audit(?:able| trail)?",
  "monitor",
  "oversight",
  "track",
  "caught",
  "score",
  "adoption",
  "leaderboard",
  "performance",
  "observability",
  "enablement",
  "endorsement",
  "stand behind",
  "roi",
  "return on",
  "your manager",
  "who decided",
  "who made each call",
  "workslop",
  "shadow ai",
  "usage",
];

describe("pass L1 hidden landing route", () => {
  it("keeps banned language out", () => {
    for (const phrase of BANNED) {
      expect(copyWithoutRequiredHeadline).not.toMatch(new RegExp(`\\b(?:${phrase})\\b`, "i"));
    }
    expect(renderedCopy).toContain(requiredReportHeadline);
    expect(renderedCopy).toContain("the decisions your team made");
    expect(renderedCopy).toContain("defend to a client, a partner, or a board");
  });

  it("has no em dashes in page strings", () => {
    expect(route).not.toContain("\u2014");
  });

  it("uses one B2B variant with no search-param branch", () => {
    expect(route).not.toContain("validateSearch");
    expect(route).not.toContain('variant === "b"');
    expect(route).toContain("Your firm bought AI. The human judgment in your team's work went invisible.");
    expect(route.match(/Your firm bought AI\. Now nobody can say where a number came from\./g)).toHaveLength(1);
    expect(route).toContain("export const HERO_H1_FALLBACK");
  });

  it("is the indexable home page, with the old path redirecting to it", () => {
    const home = readFileSync("src/routes/index.tsx", "utf8");
    const old = readFileSync("src/routes/landing-next.tsx", "utf8");
    expect(home).toContain("<B2BLanding surface=\"home\" />");
    expect(home).not.toContain("noindex");
    expect(home).toContain(
      "Lasso: the human judgment in your team's AI work, traced",
    );
    expect(old).toContain('redirect({ to: "/", replace: true })');
    expect(route).not.toContain('to="/landing-next"');
  });

  it("keeps a link to the individual page", () => {
    expect(route).toContain('to="/personal"');
    expect(route).toContain("For individuals");
  });

  it("reuses the existing event with additive dimensions", () => {
    expect(route).toContain('event_type: "landing.viewed"');
    expect(route).toContain('dims: { variant: "b2b", surface }');
    expect(route).toContain('event_type: "landing.pilot_cta_clicked"');
    expect(route).toContain('dims: { location }');
    expect(route).toContain('event_type: "landing.see_it_work_clicked"');
    expect(route).toContain('dims: { location: "hero" }');
  });

  it("keeps stable clip slots for the next media pass", () => {
    for (const id of ["inbox", "find-it", "decisions", "coach-note", "workboard"]) {
      expect(route).toContain(`id=\"${id}\"`);
    }
    expect(route).not.toContain('id="one-on-one"');
  });

  it("wires every available poster frame", () => {
    // Each carousel panel plays a real clip with its own poster file.
    for (const poster of ["inbox-poster.png", "find-it-poster.png", "decisions-poster.png", "coach-note-poster.png"]) {
      expect(route).toContain(`poster="/videos/${poster}"`);
    }
    expect(route).not.toContain("poster-what-fed-this.jpg");
  });

  it("plays every carousel clip at its native size", () => {
    for (const id of ["inbox", "find-it", "decisions", "coach-note"]) {
      expect(route).toContain(`src="/videos/${id}.mp4"`);
      expect(route).toContain(`poster="/videos/${id}-poster.png"`);
    }
    expect(route).not.toContain('src="/videos/lasso-what-fed-this.mp4"');
    expect(route).toContain('<ClipSlot id="workboard" label="An engagement arranged on one board" />');
    expect(route).toContain('playback="hold"');
  });

  it("renders the exact pilot flow without sending form contents", () => {
    expect(route).toContain('id="pilot"');
    expect(route.match(/Book a pilot/g)).toHaveLength(2);
    expect(route).toContain("function submitPilotRequest");
    expect(route).toContain("Thanks. Liam will be in touch within a day.");
    expect(route).not.toContain("FormData");
  });
});

describe("ClipPlayer held playback", () => {
  const clip = readFileSync("src/components/marketing/ClipPlayer.tsx", "utf8");

  it("keeps looping as the default and restarts held clips after two seconds", () => {
    expect(clip).toContain('playback = "loop"');
    expect(clip).toContain('loop={playback === "loop"}');
    expect(clip).toContain("onEnded={holdAndRestart}");
    expect(clip).toContain("}, 2000)");
    expect(clip).toContain("el.currentTime = 0");
    expect(clip).toContain("arbitrate()");
    expect(clip).toContain("!p.holding");
    expect(clip).toContain("playerEntry.current.holding = true");
    expect(clip).toContain("playerEntry.current.holding = false");
  });
});