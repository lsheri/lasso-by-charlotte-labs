import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/index.tsx", "utf8");
const clip = readFileSync("src/components/marketing/ClipPlayer.tsx", "utf8");
const source = `${route}\n${clip}`;
const flat = route.replace(/\s+/g, " ");

const COPY: string[] = [
  "LASSO · BY CHARLOTTE LABS",
  "Circle any fact in a deliverable and see exactly where it came from, across every tool your team used.",
  "Every deliverable carries the record of how it was made. Email, chats, drive, in the order the work actually happened.",
  "The record also shows what was never checked, and what to run to check it.",
  "Sample data from a test engagement. Not client work.",
  "WHAT ACCUMULATES",
  "Every finished piece of work leaves a trace of how it was made. Over an engagement, then a practice, then a firm, those traces become something a firm can actually learn from: how this kind of analysis gets built here, what the good version looked like, which claims held up.",
  "The work belongs to the people who did it. What the firm sees is the work they chose to place there, never a feed of what anyone is doing.",
  "HOW IT WORKS",
  "Private by default. Work you do not place stays private.",
  "Nobody is scored. There is no rating, ranking, or percentage about any person.",
  "You own your record. It travels with you.",
  "Charlotte Labs · hello@charlotte-labs.com",
  "https://charlotte-labs.com",
];

const BANNED = [
  "monitor",
  "monitoring",
  "track",
  "tracking",
  "oversight",
  "surveillance",
  "observability",
  "compliance",
  "integrity",
  "fluency",
  "caught",
  "adoption dashboard",
  "usage",
];

describe("pass 138 landing page", () => {
  it("pins every copy string verbatim", () => {
    for (const line of COPY) {
      expect(flat).toContain(line.replace(/\s+/g, " "));
    }
  });

  it("uses no em dashes", () => {
    expect(route).not.toContain("\u2014");
  });

  it("uses none of the banned words", () => {
    for (const word of BANNED) {
      expect(source.toLowerCase()).not.toContain(word);
    }
  });

  it("pins both video and poster paths", () => {
    expect(route).toContain("/videos/lasso-work-artifact.mp4");
    expect(route).toContain("/videos/poster-work-artifact.jpg");
    expect(route).toContain("/videos/lasso-fact-check.mp4");
    expect(route).toContain("/videos/poster-fact-check.jpg");
  });

  it("keeps both clips muted, looping, inline and unpreloaded", () => {
    expect(clip).toContain("muted");
    expect(clip).toContain("loop");
    expect(clip).toContain("playsInline");
    expect(clip).toContain('preload="none"');
    expect(clip).not.toContain("controls");
    expect(clip).toContain("IntersectionObserver");
    expect(clip).toContain("prefers-reduced-motion");
  });

  it("gives each clip its own aspect ratio", () => {
    expect(route).toContain("height={776}");
    expect(route).toContain("height={832}");
  });

  it("has no booking or calendar link and no audio element", () => {
    expect(source).not.toMatch(/<audio/i);
    expect(source.toLowerCase()).not.toMatch(/calendly|cal\.com|book a|calendar|schedule a/);
  });

  it("disables session replay for this public route only", () => {
    expect(route).toContain("stopSessionReplay");
    expect(route).toContain("startSessionReplay");
  });
});
