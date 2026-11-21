// 21 Nov 2026, click path cards: the pure rules of the step card and the proposal step card.
import { describe, expect, it } from "vitest";

import {
  FLOW_COPY,
  HOME_START_COPY,
  firstWord,
  flowBack,
  flowMarker,
  flowSteps,
  needsSend,
} from "@/lib/proposal-flow-shared";
import {
  SHEET_CLOSE_FLICK,
  SHEET_CLOSE_PULL,
  STEP_CARD_COPY,
  sheetFollow,
  sheetSettle,
  stepDirection,
  washAt,
} from "@/lib/step-card-shared";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String((value as (...a: unknown[]) => unknown)("Christy", 2))];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("the sheet's swipe", () => {
  it("closes past 110px, or on a flick down, and settles back otherwise", () => {
    expect(SHEET_CLOSE_PULL).toBe(110);
    expect(sheetSettle(110, 0)).toBe("close");
    expect(sheetSettle(60, 0.1)).toBe("stay");
    expect(sheetSettle(30, SHEET_CLOSE_FLICK)).toBe("close");
    expect(sheetSettle(3, 5)).toBe("stay");
    expect(sheetSettle(-80, 5)).toBe("stay");
    expect(sheetSettle(Number.NaN, 1)).toBe("stay");
  });
  it("follows a finger down all the way and only a little up", () => {
    expect(sheetFollow(80)).toBe(80);
    expect(sheetFollow(-400)).toBeGreaterThanOrEqual(-12);
    expect(sheetFollow(Number.NaN)).toBe(0);
  });
  it("lifts the soft page as the sheet goes", () => {
    expect(washAt(0, 600)).toBe(1);
    expect(washAt(300, 600)).toBe(0.5);
    expect(washAt(900, 600)).toBe(0);
    expect(washAt(100, 0)).toBe(1);
  });
  it("slides forward to a later step and back to an earlier one", () => {
    expect(stepDirection(0, 1)).toBe("forward");
    expect(stepDirection(2, 1)).toBe("back");
  });
});

describe("the proposal steps", () => {
  it("are Start, Pick the lead and Send for someone who picks leads; Start alone for anyone else who starts", () => {
    expect(flowSteps({ mayStart: true, canPickLead: true })).toEqual(["start", "lead", "send"]);
    expect(flowSteps({ mayStart: true, canPickLead: false })).toEqual(["start"]);
    expect(flowSteps({ mayStart: false, canPickLead: true })).toEqual(["brief", "pass"]);
  });
  it("say where you are, and the ask on the lead sheet is the Send step", () => {
    const steps = flowSteps({ mayStart: true, canPickLead: true });
    expect(flowMarker("start", steps)).toEqual({ n: 1, total: 3 });
    expect(flowMarker("lead", steps)).toEqual({ n: 2, total: 3 });
    expect(flowMarker("lead", steps, true)).toEqual({ n: 3, total: 3 });
    expect(flowMarker("done", steps)).toBeNull();
    expect(flowMarker("start", ["start"])).toBeNull();
  });
  it("go back only until something was saved", () => {
    const steps = flowSteps({ mayStart: false, canPickLead: false });
    expect(flowBack("pass", steps, false)).toBe("brief");
    expect(flowBack("brief", steps, false)).toBeNull();
    expect(flowBack("lead", ["start", "lead", "send"], true)).toBeNull();
  });
  it("offer the documents only when some are on the proposal and not shared with a lead who can open them", () => {
    expect(needsSend({ leadDocs: "unsent", contextCount: 2 })).toBe(true);
    expect(needsSend({ leadDocs: "more", contextCount: 3 })).toBe(true);
    expect(needsSend({ leadDocs: "sent", contextCount: 2 })).toBe(false);
    expect(needsSend({ leadDocs: "no_login", contextCount: 2 })).toBe(false);
    expect(needsSend({ leadDocs: "unsent", contextCount: 0 })).toBe(false);
    expect(needsSend(undefined)).toBe(false);
  });
  it("first names", () => {
    expect(firstWord("  Christy Johnson ")).toBe("Christy");
    expect(firstWord(null)).toBe("");
  });
  it("copy has no em dashes and never mentions money", () => {
    const all = [...strings(FLOW_COPY), ...strings(HOME_START_COPY), ...strings(STEP_CARD_COPY)];
    expect(all.length).toBeGreaterThan(20);
    for (const line of all) {
      expect(line).not.toMatch(/—/);
      expect(line).not.toMatch(/\$|fee|price|cost/i);
    }
  });
});
