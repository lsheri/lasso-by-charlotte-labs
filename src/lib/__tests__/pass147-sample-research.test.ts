import { describe, expect, it } from "vitest";

import {
  CONSENT_TEXT_VERSION,
  RESEARCH_BODY,
  RESEARCH_EVENT,
  RESEARCH_HEADING,
  RESEARCH_SAVED_LINE,
  SAMPLE_BUTTON_LABEL,
  SAMPLE_CONTENT_LINE,
  SAMPLE_EMPTY_LINE,
  SAMPLE_INTRO_LINE,
  SAMPLE_NO_KEY_LINE,
  SAMPLE_PERSON_KEY_LINE,
  sampleEventForTier,
  tierCopy,
} from "../data-consent-shared";

const BANNED = [
  "score", "scored", "scoring", "monitor", "monitoring", "track", "tracking", "tracked",
  "surveillance", "oversight", "governance", "compliance", "integrity", "telemetry",
  "analytics", "data collection",
];

const keys = (tier: Parameters<typeof sampleEventForTier>[0]) =>
  sampleEventForTier(tier).fields.map((f) => f.key);

describe("sample per level", () => {
  it("shows nothing at t0", () => {
    const sample = sampleEventForTier("t0");
    expect(sample.fields).toEqual([]);
    expect(sample.notes).toEqual([SAMPLE_EMPTY_LINE]);
  });

  it("has no person key at a", () => {
    expect(keys("a")).not.toContain("person_key");
    expect(sampleEventForTier("a").notes).toContain(SAMPLE_NO_KEY_LINE);
  });

  it("adds a person key at b and no titles", () => {
    expect(keys("b")).toContain("person_key");
    expect(keys("b")).not.toContain("title");
    expect(sampleEventForTier("b").notes).toContain(SAMPLE_PERSON_KEY_LINE);
  });

  it("adds titles and file names at c, no excerpt", () => {
    expect(keys("c")).toEqual(expect.arrayContaining(["title", "file_name", "kind"]));
    expect(keys("c")).not.toContain("excerpt");
  });

  it("adds an excerpt at d", () => {
    expect(keys("d")).toContain("excerpt");
    expect(sampleEventForTier("d").notes).toContain(SAMPLE_CONTENT_LINE);
  });
});

describe("research choice", () => {
  it("names one event only", () => {
    expect(RESEARCH_EVENT).toBe("consent.research_change");
  });
});

describe("copy", () => {
  it("bumps the version", () => {
    expect(CONSENT_TEXT_VERSION).toBe("dc-v3");
  });

  it("names titles and file names at the work details level", () => {
    expect(tierCopy("c").description).toContain("titles and file names");
  });

  it("uses none of the banned words and no em dashes", () => {
    const strings = [
      SAMPLE_BUTTON_LABEL, SAMPLE_EMPTY_LINE, SAMPLE_NO_KEY_LINE, SAMPLE_PERSON_KEY_LINE,
      SAMPLE_CONTENT_LINE, SAMPLE_INTRO_LINE, RESEARCH_HEADING, RESEARCH_BODY,
      RESEARCH_SAVED_LINE, tierCopy("c").description,
      ...(["t0", "a", "b", "c", "d"] as const).flatMap((tier) => [
        ...sampleEventForTier(tier).notes,
        ...sampleEventForTier(tier).fields.map((f) => f.value),
      ]),
    ];
    for (const value of strings) {
      expect(value).not.toContain("\u2014");
      const lower = value.toLowerCase();
      for (const word of BANNED) {
        expect(new RegExp(`\\b${word}\\b`).test(lower), `${word} in "${value}"`).toBe(false);
      }
    }
  });
});
