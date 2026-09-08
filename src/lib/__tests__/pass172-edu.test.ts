import { describe, expect, it } from "vitest";

import { openAiKeyFor, DEFAULT_KEY_NAME, EDU_KEY_NAME } from "@/lib/ai-key";
import { kindOf, readKinds, withKind, KIND_QUESTION } from "@/lib/edu-kinds";
import { DEFAULT_VOCAB, EDU_VOCAB, isEduOrg, vocabFor } from "@/lib/edu-vocab";
import {
  isInPortfolio,
  PORTFOLIO_ADD_LABEL,
  PORTFOLIO_EMPTY_LINE,
  PORTFOLIO_PRIVACY_LINE,
  PORTFOLIO_REMOVE_LABEL,
  portfolioSection,
  withPortfolio,
} from "@/lib/portfolio";
import { EDU_JOIN_COPY } from "@/routes/join_.edu";
import { eduNavGroups, navGroups } from "@/components/layout/nav-config";

const BANNED =
  /\b(score|scored|scoring|monitor|monitoring|track|tracking|tracked|surveillance|oversight|governance|compliance|integrity|fluency|gaps|caught|telemetry|analytics)\b/i;

function copyStrings(): string[] {
  return [
    ...Object.values(DEFAULT_VOCAB),
    ...Object.values(EDU_VOCAB),
    KIND_QUESTION,
    PORTFOLIO_ADD_LABEL,
    PORTFOLIO_REMOVE_LABEL,
    PORTFOLIO_EMPTY_LINE,
    PORTFOLIO_PRIVACY_LINE,
    EDU_JOIN_COPY.headline,
    EDU_JOIN_COPY.sub,
    EDU_JOIN_COPY.cta,
    EDU_JOIN_COPY.reassurance,
    ...EDU_JOIN_COPY.points.flatMap((pair) => [pair[0], pair[1]]),
  ];
}

describe("pass172 vocabulary", () => {
  it("leaves every non school workspace byte identical", () => {
    expect(vocabFor(null)).toEqual(DEFAULT_VOCAB);
    expect(vocabFor({ org_type: "company" })).toEqual(DEFAULT_VOCAB);
    expect(vocabFor({ org_type: "personal" })).toEqual(DEFAULT_VOCAB);
    expect(DEFAULT_VOCAB.engagements).toBe("Engagements");
    expect(DEFAULT_VOCAB.orgGroup).toBe("Your organization");
    expect(DEFAULT_VOCAB.pastWork).toBe("Past work");
  });

  it("gives a school workspace school words", () => {
    expect(isEduOrg({ org_type: "edu" })).toBe(true);
    expect(vocabFor({ org_type: "edu" })).toEqual(EDU_VOCAB);
    expect(EDU_VOCAB.classes).toBe("Classes");
    expect(EDU_VOCAB.assignments).toBe("Assignments");
  });
});

describe("pass172 navigation", () => {
  const flat = (groups: typeof navGroups) => groups.flatMap((g) => g.items.map((i) => i.to));

  it("keeps every existing destination", () => {
    for (const to of flat(navGroups)) expect(flat(eduNavGroups)).toContain(to);
    expect(navGroups.some((g) => g.label === "Your organization")).toBe(true);
  });

  it("adds the school places and keeps the engagement shelves group", () => {
    expect(flat(eduNavGroups)).toEqual(
      expect.arrayContaining(["/classes", "/projects", "/assignments", "/portfolio"]),
    );
    expect(eduNavGroups.some((g) => g.id === "engagements")).toBe(true);
    expect(flat(navGroups)).not.toContain("/portfolio");
  });
});

describe("pass172 class or project", () => {
  it("stores a kind in the existing settings object without mutating", () => {
    const settings = { type: "edu" };
    const next = withKind(settings, "e1", "class");
    expect(settings).toEqual({ type: "edu" });
    expect(next["type"]).toBe("edu");
    expect(kindOf(next, "e1")).toBe("class");
    expect(kindOf(next, "e2")).toBeNull();
    expect(readKinds({ edu_engagement_kinds: { e1: "nonsense" } })).toEqual({});
  });
});

describe("pass172 portfolio", () => {
  it("promotes and un-promotes one item, keeping other meta", () => {
    const meta = { drive_file_id: "abc" };
    const on = withPortfolio(meta, true);
    expect(on).toEqual({ drive_file_id: "abc", portfolio: true });
    expect(isInPortfolio({ meta: on })).toBe(true);
    const off = withPortfolio(on, false);
    expect(off).toEqual({ drive_file_id: "abc" });
    expect(isInPortfolio({ meta: off })).toBe(false);
    expect(isInPortfolio(null)).toBe(false);
  });

  it("reports a closed source section only", () => {
    expect(portfolioSection("class")).toBe("class");
    expect(portfolioSection("project")).toBe("project");
    expect(portfolioSection(null)).toBe("other");
    expect(portfolioSection("class", { fromWorkstream: true })).toBe("assignment");
  });
});

describe("pass172 key selection", () => {
  it("prefers the school key for a school workspace and falls back", () => {
    const env = { [EDU_KEY_NAME]: " edu-key\n", [DEFAULT_KEY_NAME]: "main-key" };
    expect(openAiKeyFor("edu", env)?.key).toBe("edu-key");
    expect(openAiKeyFor("personal", env)?.key).toBe("main-key");
    expect(openAiKeyFor("edu", { [DEFAULT_KEY_NAME]: "main-key" })?.key).toBe("main-key");
    expect(openAiKeyFor("edu", {})).toBeNull();
  });
});

describe("pass172 language", () => {
  it("uses no forbidden word and no em dash", () => {
    for (const line of copyStrings()) {
      expect(line, line).not.toMatch(BANNED);
      expect(line, line).not.toContain("—");
    }
  });
});
