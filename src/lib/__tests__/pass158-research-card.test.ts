import { describe, expect, it } from "vitest";

import { PURPOSE_COPY, VISIBLE_PURPOSE_COPY } from "../consent-shared";
import {
  RESEARCH_BODY,
  RESEARCH_COPY_VERSION,
  RESEARCH_EVENT,
  RESEARCH_HEADING,
  RESEARCH_JOINED_LINE,
  RESEARCH_NOT_JOINED_LINE,
  RESEARCH_NOTE,
  researchStateLine,
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
  "surveillance",
  "oversight",
  "governance",
  "compliance",
];

describe("pass 158 — one research card", () => {
  it("asks the question once: no research switch in either purpose list", () => {
    expect(PURPOSE_COPY.some((p) => p.purpose === "research")).toBe(false);
    expect(VISIBLE_PURPOSE_COPY.some((p) => p.purpose === "research")).toBe(false);
  });

  it("the Data use list renders exactly three cards", () => {
    expect(VISIBLE_PURPOSE_COPY.map((p) => p.purpose)).toEqual([
      "operate",
      "customer_analytics",
      "deidentified_improvement",
    ]);
  });

  it("the cold sentences are gone", () => {
    const all = PURPOSE_COPY.flatMap((p) => [p.title, p.unlocks, p.declining]).join(" ");
    expect(all).not.toContain("under a written protocol");
    expect(all).not.toContain("out of every study");
  });

  it("says the new wording exactly", () => {
    expect(RESEARCH_HEADING).toBe("Research");
    expect(RESEARCH_BODY).toBe(
      "Help build the public record of how people and AI actually work together. Workspaces that take part power Lasso's published studies and benchmarks, drawn from material at the level you chose above. Everything published is de-identified: no names, no workspaces, no one traceable back.",
    );
    expect(RESEARCH_NOTE).toBe(
      "Taking part is your choice and changes nothing else in your workspace. Join or leave any time.",
    );
  });

  it("shows the state in words", () => {
    expect(researchStateLine("joined")).toBe(RESEARCH_JOINED_LINE);
    expect(researchStateLine("left")).toBe(RESEARCH_NOT_JOINED_LINE);
    expect(researchStateLine(null)).toBe(RESEARCH_NOT_JOINED_LINE);
  });

  it("the choice record is unchanged", () => {
    expect(RESEARCH_EVENT).toBe("consent.research_change");
  });

  it("bumps the research wording version", () => {
    expect(RESEARCH_COPY_VERSION).toBe("research-v2");
  });

  it("language laws hold on the new copy", () => {
    const strings = [
      RESEARCH_HEADING,
      RESEARCH_BODY,
      RESEARCH_NOTE,
      RESEARCH_JOINED_LINE,
      RESEARCH_NOT_JOINED_LINE,
    ];
    for (const value of strings) {
      expect(value).not.toContain("—");
      const lower = value.toLowerCase();
      for (const word of BANNED) {
        expect(new RegExp(`\\b${word}\\b`).test(lower), `${word} in "${value}"`).toBe(false);
      }
    }
  });
});
