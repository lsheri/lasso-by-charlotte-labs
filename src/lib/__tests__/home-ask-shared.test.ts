// 21 Nov, D-85 PR B: who gets Home's mini firm brain, the greeting, starters from the person's own board, and the
// hand-off between Home and Firm brain, which is memory only and taken once.
import { beforeEach, describe, expect, it } from "vitest";

import { FIRM_ASK_STARTER_COPY } from "@/lib/firm-ask-shared";
import {
  cameFromHome,
  clearHandOff,
  HAND_OFF_MS,
  firstNameOf,
  greetingFor,
  handOffQuestion,
  HOME_ASK_COPY,
  homeAsksTheFirm,
  homeStarters,
  resetHomeHandOff,
  startReturn,
  takeHandedQuestion,
  takeReturn,
} from "@/lib/home-ask-shared";

const person = (role: string, over: Record<string, unknown> = {}) => ({
  role,
  org_type: "company",
  has_firm_view: true,
  is_guest: false,
  ...over,
});

beforeEach(() => resetHomeHandOff());

describe("who gets the mini firm brain", () => {
  it("is every firm member who is not an admin", () => {
    for (const role of ["lead", "em"]) expect(homeAsksTheFirm(person(role))).toBe(true);
    expect(homeAsksTheFirm(person("admin"))).toBe(false);
    expect(homeAsksTheFirm(person("coach"))).toBe(false);
    expect(homeAsksTheFirm(person("em", { is_guest: true }))).toBe(false);
    expect(homeAsksTheFirm(person("em", { org_type: "personal", has_firm_view: false }))).toBe(
      false,
    );
    expect(homeAsksTheFirm(null)).toBe(false);
  });
});

describe("the greeting", () => {
  it("follows the person's own clock and uses their first name, or none", () => {
    expect(greetingFor(8)).toBe("Morning");
    expect(greetingFor(12)).toBe("Afternoon");
    expect(greetingFor(17)).toBe("Afternoon");
    expect(greetingFor(18)).toBe("Evening");
    expect(firstNameOf("Elif Yilmaz")).toBe("Elif");
    expect(firstNameOf("  Harper  Quinn ")).toBe("Harper");
    expect(firstNameOf(null)).toBe("");
    expect(HOME_ASK_COPY.greeting(20, "Elif")).toBe("Evening, Elif");
    expect(HOME_ASK_COPY.greeting(9, "")).toBe("Morning");
  });
});

describe("starters", () => {
  it("finishes each starter with the most recent board, so one press asks a whole question", () => {
    expect(homeStarters("em", "Claims product operating model")).toEqual([
      `${FIRM_ASK_STARTER_COPY.similar.stem}Claims product operating model?`,
      `${FIRM_ASK_STARTER_COPY.went_wrong.stem}Claims product operating model?`,
    ]);
  });

  it("keeps What we charged for leads, and shows none without a board", () => {
    expect(homeStarters("lead", "Pricing")).toContain(
      `${FIRM_ASK_STARTER_COPY.charged.stem}Pricing?`,
    );
    expect(
      homeStarters("em", "Pricing").some((s) => s.startsWith(FIRM_ASK_STARTER_COPY.charged.stem)),
    ).toBe(false);
    expect(homeStarters("em", null)).toEqual([]);
    expect(homeStarters("em", "  ")).toEqual([]);
  });

  it("never runs past the question limit", () => {
    for (const starter of homeStarters("lead", "x".repeat(800)))
      expect(starter.length).toBeLessThanOrEqual(500);
  });
});

describe("the hand-off", () => {
  it("passes one question, taken once, by the person it was handed to", () => {
    expect(takeHandedQuestion("p1")).toBeNull();
    handOffQuestion("How did we launch health service lines?", null, "p1");
    expect(cameFromHome()).toBe(true);
    expect(takeHandedQuestion("p1")).toEqual({
      question: "How did we launch health service lines?",
      result: null,
    });
    expect(takeHandedQuestion("p1")).toBeNull();
  });

  it("never hands a question to someone else signed in in the same tab, and clears it on that take (QA H2)", () => {
    handOffQuestion("A private question", null, "p1");
    expect(takeHandedQuestion("p2")).toBeNull();
    expect(takeHandedQuestion("p1")).toBeNull();
    handOffQuestion("A private question", null, "p1");
    expect(takeHandedQuestion(null)).toBeNull();
  });

  it("lets a stale hand-off go: one left from a trip that did not happen is never built later (QA H2)", () => {
    handOffQuestion("Old question", null, "p1", 1_000);
    expect(takeHandedQuestion("p1", 1_000 + HAND_OFF_MS + 1)).toBeNull();
    handOffQuestion("Fresh question", null, "p1", 1_000);
    expect(takeHandedQuestion("p1", 1_000 + HAND_OFF_MS - 1)?.question).toBe("Fresh question");
  });

  it("is let go by Home when the person leaves before Firm brain opens (QA H2)", () => {
    handOffQuestion("q", null, "p1");
    clearHandOff();
    expect(takeHandedQuestion("p1")).toBeNull();
    expect(cameFromHome()).toBe(false);
  });

  it("passes where the box grows back from, taken once, and ends the trip", () => {
    handOffQuestion("q", null, "p1");
    startReturn({ left: 10, top: 20, width: 200, height: 40 });
    expect(cameFromHome()).toBe(false);
    expect(takeReturn()).toEqual({ left: 10, top: 20, width: 200, height: 40 });
    expect(takeReturn()).toBeNull();
  });

  it("writes nothing to storage or the address", () => {
    handOffQuestion("A private question", null, "p1");
    expect(
      JSON.stringify({ ...globalThis.sessionStorage, ...globalThis.localStorage }),
    ).not.toContain("A private question");
  });
});

describe("words", () => {
  it("has no em dash and no audit words", () => {
    const all = JSON.stringify(HOME_ASK_COPY) + HOME_ASK_COPY.greeting(9, "A");
    expect(all).not.toMatch(/—|–/);
    expect(all).not.toMatch(/audit|surveil|monitor|track/i);
  });
});
