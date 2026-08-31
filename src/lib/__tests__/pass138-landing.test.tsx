import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/index.tsx", "utf8");
const clip = readFileSync("src/components/marketing/ClipPlayer.tsx", "utf8");
const header = readFileSync("src/components/layout/PublicHeader.tsx", "utf8");
const source = `${route}\n${clip}`;
/** Copy only: Tailwind class strings are not user-facing language. */
const copySource = source.replace(/className="[^"]*"/g, "");
const flat = route.replace(/\s+/g, " ");

const COPY: string[] = [
"Circle any fact in a deliverable and see exactly where it came from, across every tool your team used.",
  "Every deliverable carries the record of how it was made. Email, chats, drive, in the order the work actually happened.",
  "The record also shows what was never checked, and what to run to check it.",
  "WHAT ACCUMULATES",
  "Every finished piece of work leaves a trace of how it was made. Over an engagement, then a practice, then a firm, those traces become something a firm can actually learn from: how this kind of analysis gets built here, what the good version looked like, which claims held up.",
  "The work belongs to the people who did it. What the firm sees is the work they chose to place there, never a feed of what anyone is doing.",
  "HOW IT WORKS",
  "Private by default. Work you do not place stays private.",
  "Nobody is scored. There is no rating, ranking, or percentage about any person.",
  "You own your record. It travels with you.",
  "liam@charlotte-labs.com",
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
      expect(copySource.toLowerCase()).not.toContain(word);
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

describe("pass139 restored navigation and CTAs", () => {
  it("renders the shared PublicHeader on /", () => {
    expect(route).toContain('import { PublicHeader } from "@/components/layout/PublicHeader"');
    expect(route).toContain('<PublicHeader current="/" />');
  });

  it("links the route to /auth, /why and /trust", () => {
    expect(route).toContain('to="/auth"');
    expect(route).toContain('to="/why"');
    expect(route).toContain('to="/trust"');
  });

  it("restores both primary CTAs with their intents", () => {
    expect(route).toContain("Start your record");
    expect(route).toContain('search={{ intent: "personal" }}');
    expect(route).toContain("Set up for a company");
    expect(route).toContain('search={{ intent: "company" }}');
    expect(route).toContain('variant="outline"');
  });

  it("pins the problem paragraph verbatim", () => {
    expect(flat).toContain(
      "AI work happens in chat windows, ships inside deliverables, and vanishes. Not because anyone hides it, because nothing keeps it.",
    );
  });

  it("renders PrivacyToggleDemo between WHAT ACCUMULATES and HOW IT WORKS", () => {
    expect(route).toContain("<PrivacyToggleDemo />");
    expect(route).toContain("PRIVACY, DEMONSTRATED");
    expect(route).toContain("What a coach sees.");
    expect(route.indexOf("WHAT ACCUMULATES")).toBeLessThan(route.indexOf("<PrivacyToggleDemo />"));
    expect(route.indexOf("<PrivacyToggleDemo />")).toBeLessThan(
      route.lastIndexOf("HOW IT WORKS"),
    );

  });

it("keeps the quiet bottom link to a personal record", () => {
    expect(route).toContain("Start my own record");
  });

  it("uses pencil titles on every content section", () => {
    for (const t of [
      "How the work was made",
      "What was never checked",
      "A library your team can learn from",
      "What a coach sees.",
      "How it works",
    ]) {


    ]) {
      expect(route).toContain(t);
    }
    expect(route).toContain("pencil-title");
  });

  it("wraps sections in the scroll focus wrapper", () => {
    expect(route).toContain("<FocusSection");
  });

  it("drops the sample data notice", () => {
    expect(route).not.toContain("Sample data from a test engagement");
  });

  it("carries site, email and linkedin links in the footer", () => {
    expect(route).toContain("mailto:liam@charlotte-labs.com");
    expect(route).toContain("https://charlotte-labs.com");
    expect(route).toContain("linkedin.com");
  });

  it("shows no micro-label above the hero title", () => {
    expect(route).not.toContain("LASSO · BY CHARLOTTE LABS");
  });

  it("brands the header with LASSO and a smaller by Charlotte Labs line", () => {
    expect(header).toContain("LASSO");
    expect(header).toContain("by Charlotte Labs");
  });
});
