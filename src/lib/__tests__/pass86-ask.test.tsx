import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sessionRelatedToEngagement } from "@/lib/reflect-scope-shape";
import { clampDockWidth, maxDockWidth } from "@/components/reflect/ask-dock-state";

const WHERE = { engagementId: "e1", mappedItemIds: ["i1", "i2"], taskIds: ["t1"] };

describe("sessionRelatedToEngagement", () => {
  it("never lists a whole record chat on an engagement", () => {
    expect(sessionRelatedToEngagement({ mode: "whole", ids: [] }, WHERE)).toBe(false);
    expect(sessionRelatedToEngagement({ mode: "whole", ids: ["e1"] }, WHERE)).toBe(false);
  });

  it("lists chats scoped to this engagement only", () => {
    expect(sessionRelatedToEngagement({ mode: "engagements", ids: ["e1"] }, WHERE)).toBe(true);
    expect(sessionRelatedToEngagement({ mode: "engagements", ids: ["e2"] }, WHERE)).toBe(false);
  });

  it("lists chats scoped to one of its workstreams", () => {
    expect(sessionRelatedToEngagement({ mode: "tasks", ids: ["t1"] }, WHERE)).toBe(true);
    expect(sessionRelatedToEngagement({ mode: "tasks", ids: ["t9"] }, WHERE)).toBe(false);
  });

  it("lists chats scoped to work mapped into it", () => {
    expect(sessionRelatedToEngagement({ mode: "items", ids: ["i2", "x"] }, WHERE)).toBe(true);
    expect(sessionRelatedToEngagement({ mode: "items", ids: ["x"] }, WHERE)).toBe(false);
  });

  it("treats empty ids as unrelated in every mode", () => {
    for (const mode of ["engagements", "tasks", "items"] as const) {
      expect(sessionRelatedToEngagement({ mode, ids: [] }, WHERE)).toBe(false);
    }
    expect(
      sessionRelatedToEngagement({ mode: "items", ids: ["i1"] }, {
        ...WHERE,
        mappedItemIds: [],
      }),
    ).toBe(false);
  });
});

describe("ask dock width", () => {
  it("clamps to 320-560", () => {
    expect(clampDockWidth(100)).toBe(320);
    // Pass 95.1 raised the ceiling to about seven tenths of the window.
    expect(clampDockWidth(9000)).toBe(maxDockWidth());
    expect(clampDockWidth(400)).toBe(400);
    expect(clampDockWidth(Number.NaN)).toBe(380);
  });
});

describe("ask lasso reads stay gated", () => {
  const src = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");

  it("keeps the pass-82 open guards on the dock reads", () => {
    expect(src).toContain('queryKey: ["engagement-brief-present", engagementId]');
    expect(src).toMatch(/enabled: open,/);
    expect(src).toContain("enabled: open && historySettled");
    expect(src).toContain('queryKey: ["reflect-messages", sessionId]');
    expect(src).toContain("enabled: Boolean(sessionId)");
  });

  it("keeps the live session following the selection", () => {
    expect(src).toContain('.update({ context_scope: scopeForSelection() })');
  });
});

describe("binder baseline law", () => {
  const css = readFileSync("src/styles.css", "utf8");

  it("uses a rem based pitch so the rules scale with the type ramp", () => {
    expect(css).toContain("--nb-baseline: 1.75rem");
    expect(css).toContain("background-attachment: local");
    expect(css).toContain("line-height: var(--nb-baseline)");
  });

  it("gives non grid content the white inset ring", () => {
    expect(css).toContain("box-shadow: 0 0 0 4px var(--nb-white)");
  });
});
