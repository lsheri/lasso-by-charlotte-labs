import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { TEXT_ON_ITS_WAY_MS, textOnItsWay } from "@/components/canvas-lab/LabCard";

const now = Date.parse("2026-11-09T10:00:00Z");
const at = (msAgo: number) => new Date(now - msAgo).toISOString();

describe("FIX-SHIMMER: text on its way", () => {
  it("stored text, no summary, arrived a moment ago: shimmer", () => {
    expect(textOnItsWay({ content_ref: "a/b.md", captured_at: at(5_000) }, false, now)).toBe(true);
  });
  it("past three minutes, with a summary, or with no stored text: the honest no-preview note", () => {
    expect(textOnItsWay({ content_ref: "a/b.md", captured_at: at(TEXT_ON_ITS_WAY_MS + 1) }, false, now)).toBe(false);
    expect(textOnItsWay({ content_ref: "a/b.md", captured_at: at(5_000) }, true, now)).toBe(false);
    expect(textOnItsWay({ content_ref: null, captured_at: at(5_000) }, false, now)).toBe(false);
    expect(textOnItsWay(undefined, false, now)).toBe(false);
  });
  it("the shimmer replaces the sketch only in that window", () => {
    const card = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");
    expect(card).toMatch(/noPreviewReason && !contextAvailable && textOnItsWay\(item, Boolean\(extractSummary\)\) \? \(\s*<div className="lab-card-text-loading"/);
  });
});

describe("FIX-CURSOR: editing shows the document cursor", () => {
  const css = readFileSync("src/styles.css", "utf8");
  it("anything being edited on the board drops the hand; its text takes the I-beam", () => {
    expect(css).toContain('[data-testid="canvas-lab-stage"] [data-editing="true"] { cursor: auto; }');
    expect(css).toContain('[data-testid="canvas-lab-stage"] [data-editing="true"] :is([contenteditable="true"], textarea, input[type="text"]) { cursor: text; }');
  });
  it("the pinned answer marks itself as editing", () => {
    expect(readFileSync("src/components/canvas-lab/LabAnswerCard.tsx", "utf8")).toMatch(/data-editing=\{editing \? "true" : undefined\}/);
  });
});
