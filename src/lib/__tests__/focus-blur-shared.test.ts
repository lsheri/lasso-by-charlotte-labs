// 21 Nov 2026 (Liam: "need harder blur on background when lasso chat is front and center"): one focus blur, as the
// prototype's v9, shared with the click-path step cards.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FOCUS_BLUR, FOCUS_BLUR_CSS, focusBlurAt } from "@/lib/focus-blur-shared";

describe("the focus blur", () => {
  it("is the prototype's v9: 26px, a 58 percent wash, 25 percent less colour", () => {
    expect(FOCUS_BLUR).toMatchObject({ blurPx: 26, wash: 0.58, desaturate: 0.25 });
    expect(FOCUS_BLUR_CSS).toEqual({ filter: "blur(26.00px) saturate(0.750)", opacity: 0.42, transform: "scale(0.9850)" });
  });
  it("scrubs evenly with a drag and holds at its ends", () => {
    expect(focusBlurAt(0.5).filter).toBe("blur(13.00px) saturate(0.875)");
    expect(focusBlurAt(0.5).opacity).toBe(0.71);
    expect(focusBlurAt(-1)).toEqual(focusBlurAt(0));
    expect(focusBlurAt(9)).toEqual(focusBlurAt(1));
    expect(focusBlurAt(Number.NaN)).toEqual(focusBlurAt(0));
  });
  it("the pill's stylesheet says the same at rest, and the left menu sits outside what blurs", () => {
    const css = readFileSync("src/components/pill/chat-pill.css", "utf8");
    const full = css.slice(css.indexOf('[data-lasso="on"][data-pill-full] [data-pill-behind] {'));
    const rule = full.slice(0, full.indexOf("}"));
    expect(rule).toContain(`filter: blur(${FOCUS_BLUR.blurPx}px) saturate(${1 - FOCUS_BLUR.desaturate})`);
    expect(rule).toContain(`opacity: ${Number((1 - FOCUS_BLUR.wash).toFixed(2))}`);
    const shell = readFileSync("src/components/layout/AppShell.tsx", "utf8");
    expect(shell.indexOf("data-pill-behind")).toBeGreaterThan(shell.indexOf("<AppSidebar") === -1 ? 0 : shell.indexOf("<AppSidebar"));
  });
});
