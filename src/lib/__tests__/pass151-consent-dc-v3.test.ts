import { describe, expect, it } from "vitest";

import {
  CONSENT_TEXT_VERSION,
  FULL_OPENNESS_COPY,
  RECONFIRM_BUTTON,
  RECONFIRM_LINE,
  SAMPLE_ANALYSIS_HEADING,
  SAMPLE_ANALYSIS_LINE,
  SAMPLE_THREAD,
  SAMPLE_THREAD_HEADING,
  needsReconfirm,
  sampleEventForTier,
  tierCopy,
} from "../data-consent-shared";

const BANNED = [
  "telemetry",
  "analytics",
  "data collection",
  "score",
  "scored",
  "scoring",
  "monitor",
  "monitoring",
  "track",
  "tracking",
  "tracked",
];

describe("dc-v4", () => {
  it("bumps the wording version", () => {
    expect(CONSENT_TEXT_VERSION).toBe("dc-v4");
  });

  it("says plainly what full openness shares", () => {
    const copy = tierCopy("d").description;
    expect(copy).toBe(FULL_OPENNESS_COPY);
    for (const part of [
      "Full openness",
      "Charlotte Labs",
      "turn by turn",
      "questions you asked",
      "analyses",
      "step back down at any time",
      "governed by the choice it shipped under",
    ]) {
      expect(copy).toContain(part);
    }
  });
});

describe("sample at full openness", () => {
  it("shows a three turn exchange plus an analysis line", () => {
    const sample = sampleEventForTier("d");
    expect(sample.thread).toHaveLength(3);
    expect(sample.thread?.[0]?.role).toBe("you");
    expect(sample.analysis).toBe(SAMPLE_ANALYSIS_LINE);
  });

  it("shows no exchange below full openness", () => {
    for (const tier of ["t0", "a", "b", "c"] as const) {
      expect(sampleEventForTier(tier).thread).toBeUndefined();
    }
  });
});

describe("re-confirm", () => {
  it("only asks at full openness with older wording", () => {
    expect(needsReconfirm("d", "dc-v2")).toBe(true);
    expect(needsReconfirm("d", null)).toBe(true);
    expect(needsReconfirm("d", "dc-v3")).toBe(true);
    expect(needsReconfirm("d", "dc-v4")).toBe(false);
    expect(needsReconfirm("c", "dc-v2")).toBe(false);
    expect(needsReconfirm("t0", null)).toBe(false);
  });
});

describe("language", () => {
  it("uses none of the banned words and no em dashes", () => {
    const strings = [
      FULL_OPENNESS_COPY,
      RECONFIRM_LINE,
      RECONFIRM_BUTTON,
      SAMPLE_THREAD_HEADING,
      SAMPLE_ANALYSIS_HEADING,
      SAMPLE_ANALYSIS_LINE,
      ...SAMPLE_THREAD.map((turn) => turn.text),
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
