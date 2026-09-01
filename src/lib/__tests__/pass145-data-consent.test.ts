import { describe, expect, it } from "vitest";

import {
  ABOVE_CEILING_LINE,
  CEILING_LINE_PREFIX,
  CONSENT_TEXT_VERSION,
  CONTENT_SWITCH_LINE,
  RIGHTS_BLOCK,
  SURFACE_NAME,
  TIER_COPY,
  TIER_ORDER,
  effectiveTier,
  engagementBand,
  isoWeekStart,
  noticeHash,
  renderNoticeText,
  shouldNotePresence,
  tierLabel,
  tierRank,
} from "../data-consent-shared";

const BANNED = [
  "score",
  "scored",
  "scoring",
  "monitor",
  "monitoring",
  "track",
  "tracking",
  "tracked",
  "surveillance",
  "oversight",
  "governance",
  "compliance",
  "integrity",
  "telemetry",
  "analytics",
  "data collection",
];

describe("tier lattice", () => {
  it("ranks in order", () => {
    expect(TIER_ORDER).toEqual(["t0", "a", "b", "c", "d"]);
    expect(tierRank("t0")).toBe(0);
    expect(tierRank("d")).toBe(4);
  });

  it("defaults to org c and user b", () => {
    expect(effectiveTier(null, null)).toBe("b");
    expect(effectiveTier(undefined, undefined)).toBe("b");
  });

  it("takes the lower of the two", () => {
    expect(effectiveTier("d", "a")).toBe("a");
    expect(effectiveTier("a", "d")).toBe("a");
    expect(effectiveTier("c", "c")).toBe("c");
    expect(effectiveTier("t0", "d")).toBe("t0");
  });

  it("bounds a user choice by the organization ceiling", () => {
    expect(effectiveTier("b", "d")).toBe("b");
    expect(effectiveTier("d", "d")).toBe("d");
  });

  it("labels never lead with the letter", () => {
    expect(tierLabel("t0")).toBe("Workspace only");
    expect(tierLabel("a")).toBe("Usage patterns, anonymous");
    expect(tierLabel("b")).toBe("Usage patterns, linked over time");
    expect(tierLabel("c")).toBe("Work details");
    expect(tierLabel("d")).toBe("Full work content");
  });
});

describe("notice text and hash", () => {
  it("names the version and stays stable", async () => {
    expect(CONSENT_TEXT_VERSION).toBe("dc-v4");
    const text = renderNoticeText("org", "c");
    expect(text).toContain("Work details");
    expect(await noticeHash("org", "c")).toBe(await noticeHash("org", "c"));
  });

  it("differs by scope and by level", async () => {
    expect(await noticeHash("org", "c")).not.toBe(await noticeHash("user", "c"));
    expect(await noticeHash("user", "b")).not.toBe(await noticeHash("user", "c"));
  });

  it("says plainly what the most private level keeps and shares", () => {
    const copy = tierCopy("t0").description;
    for (const part of [
      "nothing about your work leaves your workspace",
      "No words",
      "no titles",
      "no names",
      "nothing tied to you or your organization",
      "counted, anonymously",
      "AI models are in use",
      "never be traced back to you or your workspace",
    ]) {
      expect(copy).toContain(part);
    }
  });
});

describe("presence once per week", () => {
  it("gives the Monday of the ISO week", () => {
    expect(isoWeekStart(new Date("2026-09-03T12:00:00Z"))).toBe("2026-08-31");
    expect(isoWeekStart(new Date("2026-08-30T23:00:00Z"))).toBe("2026-08-24");
  });

  it("notes only once per week", () => {
    expect(shouldNotePresence(null, "2026-08-31")).toBe(true);
    expect(shouldNotePresence("2026-08-24", "2026-08-31")).toBe(true);
    expect(shouldNotePresence("2026-08-31", "2026-08-31")).toBe(false);
  });

  it("bands engagement counts", () => {
    expect(engagementBand(0)).toBe("0");
    expect(engagementBand(2)).toBe("1-2");
    expect(engagementBand(5)).toBe("3-5");
    expect(engagementBand(40)).toBe("6+");
  });
});

describe("language rules", () => {
  const strings = [
    SURFACE_NAME,
    CONTENT_SWITCH_LINE,
    RIGHTS_BLOCK,
    CEILING_LINE_PREFIX,
    ABOVE_CEILING_LINE,
    ...TIER_COPY.flatMap((copy) => [copy.label, copy.description]),
    renderNoticeText("org", "d"),
    renderNoticeText("user", "t0"),
  ];

  it("uses none of the banned words", () => {
    for (const value of strings) {
      const lower = value.toLowerCase();
      for (const word of BANNED) {
        expect(new RegExp(`\\b${word}\\b`).test(lower), `${word} in "${value}"`).toBe(false);
      }
    }
  });

  it("uses no em dashes", () => {
    for (const value of strings) expect(value).not.toContain("\u2014");
  });

  it("keeps the rights block verbatim", () => {
    expect(RIGHTS_BLOCK).toBe(
      "You see everything of yours. Private and unmapped work is invisible to everyone, always. Your choice here only ever lowers what leaves, never what you see. You can change it at any time.",
    );
  });

  it("names the feature the same in both places", () => {
    expect(SURFACE_NAME).toBe("Your data");
  });
});
