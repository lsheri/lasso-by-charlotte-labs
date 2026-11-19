// @vitest-environment jsdom
// Phase 4 PR3: the product's own copy and tab titles take the skin's name. Lasso renders unchanged; under Charlotte
// the name moves, and anything a person wrote (a board title, a confirmed link's note) stays as written.
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { trailHowLine } from "@/components/canvas-lab/LiftedTrail";
import { SuggestLegend } from "@/components/common/Suggested";
import { CoverageNote } from "@/components/reflect/CoverageNote";
import { SkinContext } from "@/components/skin/use-skin";
import { brandFor, brandTitle } from "@/design/brand/brand";
import type { Skin } from "@/lib/skin";

// 19 Nov: Slate / Spool script (Lasso) is the default look now. This file tests the Charlotte look, which allowed
// accounts can still choose, so it pins the earlier default. The default itself is tested in slate-spool-brand.test.tsx.
vi.mock("@/lib/brand-variant-shared", async (original) => ({
  ...(await original<typeof import("@/lib/brand-variant-shared")>()),
  DEFAULT_BRAND_VARIANT: "current",
}));

const text = (skin: Skin, node: ReactElement) =>
  render(<SkinContext.Provider value={skin}>{node}</SkinContext.Provider>).container.textContent;

describe("brandTitle", () => {
  it("leaves every Lasso title alone", () => {
    expect(brandTitle(brandFor("lasso"), "All work | Lasso")).toBe("All work | Lasso");
  });

  it("moves only the product name at the start or end, never a title the person wrote", () => {
    const charlotte = brandFor("charlotte");
    expect(brandTitle(charlotte, "All work | Lasso")).toBe("All work | Charlotte");
    expect(brandTitle(charlotte, "Lasso | The knowledge trace for AI-assisted work")).toBe(
      "Charlotte | The knowledge trace for AI-assisted work",
    );
    expect(brandTitle(charlotte, "Lasso plan | Lasso")).toBe("Lasso plan | Charlotte");
    expect(brandTitle(charlotte, "Why Lasso works")).toBe("Why Lasso works");
  });

  it("moves the app's own mid-sentence titles whole (Phase 4 PR6)", () => {
    const charlotte = brandFor("charlotte");
    expect(brandTitle(charlotte, "Why Lasso, the coach in your corner")).toBe("Why Charlotte, the coach in your corner");
    expect(brandTitle(charlotte, "Lasso for students | Your work record, yours")).toBe("Charlotte for students | Your work record, yours");
    expect(brandTitle(charlotte, "Lasso: the human judgment in your team's AI work, traced")).toBe("Charlotte: the human judgment in your team's AI work, traced");
    expect(brandTitle(brandFor("lasso"), "Why Lasso, the coach in your corner")).toBe("Why Lasso, the coach in your corner");
  });
});

describe("swept components follow the skin", () => {
  it("the suggestion legend names who suggested it", () => {
    expect(text("lasso", <SuggestLegend />)).toBe("Green means Lasso suggested it. Nothing is saved until you confirm.");
    expect(text("charlotte", <SuggestLegend />)).toBe("Green means Charlotte suggested it. Nothing is saved until you confirm.");
  });

  it("the coverage note says who the text was in front of", () => {
    const note = <CoverageNote fullCount={2} summaryCount={0} noTextCount={0} share={0.5} />;
    expect(text("lasso", note)).toContain("50% of the selected text was in front of Lasso.");
    expect(text("charlotte", note)).toContain("50% of the selected text was in front of Charlotte.");
  });

  it("a trail line takes the skin's name but keeps a person's note as written", () => {
    const born = { how: "born" } as Parameters<typeof trailHowLine>[0];
    const confirmed = { how: "confirmed", note: "Lasso call notes" } as Parameters<typeof trailHowLine>[0];
    expect(trailHowLine(born)).toBe("Lasso saw this happen");
    expect(trailHowLine(born, "Charlotte")).toBe("Charlotte saw this happen");
    expect(trailHowLine(confirmed, "Charlotte")).toBe("Lasso call notes");
  });
});
