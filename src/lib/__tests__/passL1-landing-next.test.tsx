import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const copySource = route.replace(/className="[^"]*"/g, "").toLowerCase();
const requiredReportHeadline = "a note in the margin, not a report on you";
const copyWithoutRequiredHeadline = copySource.replace(requiredReportHeadline, "");

const BANNED = ["audit", "monitor", "oversight", "track", "caught", "score", "adoption", "leaderboard", "performance", "observability", "enablement", "endorsement"];

describe("pass L1 hidden landing route", () => {
  it("keeps banned language out", () => {
    for (const word of BANNED) {
      expect(copyWithoutRequiredHeadline).not.toContain(word);
    }
    expect(copySource).toContain(requiredReportHeadline);
  });

  it("has no em dashes in page strings", () => {
    expect(route).not.toContain("\u2014");
  });

  it("uses one B2B variant with no search-param branch", () => {
    expect(route).not.toContain("validateSearch");
    expect(route).not.toContain('variant === "b"');
    expect(route.match(/Your firm bought AI\. Now nobody can say where a number came from\./g)).toHaveLength(1);
  });

  it("is the indexable home page, with the old path redirecting to it", () => {
    const home = readFileSync("src/routes/index.tsx", "utf8");
    const old = readFileSync("src/routes/landing-next.tsx", "utf8");
    expect(home).toContain("<B2BLanding surface=\"home\" />");
    expect(home).not.toContain("noindex");
    expect(home).toContain(
      "Lasso: see where every number in a deliverable came from",
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
  });

  it("keeps stable clip slots for the next media pass", () => {
    for (const id of ["inbox", "find-it", "decisions", "coach-note", "workboard"]) {
      expect(route).toContain(`id=\"${id}\"`);
    }
    expect(route).not.toContain('id="one-on-one"');
  });

  it("wires every available poster frame", () => {
    // Each carousel panel plays a real clip with its own poster file.
    for (const poster of ["inbox-poster.png", "find-it-poster.png", "decisions-poster.png", "coach-note-poster.png", "poster-what-fed-this.jpg"]) {
      expect(route).toContain(`poster="/videos/${poster}"`);
    }
  });

  it("plays every carousel clip at its native size", () => {
    for (const id of ["inbox", "find-it", "decisions", "coach-note"]) {
      expect(route).toContain(`src="/videos/${id}.mp4"`);
      expect(route).toContain(`poster="/videos/${id}-poster.png"`);
    }
    expect(route).toContain('src="/videos/lasso-what-fed-this.mp4"');
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