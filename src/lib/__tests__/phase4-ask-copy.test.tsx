// @vitest-environment jsdom
// Phase 4 PR2: Ask speaks with the skin's name. Lasso copy is returned untouched; Charlotte's Ask control is her name
// alone, and "Ask Lasso about..." stays an invitation. User content never passes through brandCopy.
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkinContext, useBrandCopy } from "@/components/skin/use-skin";
import { askScopeSummary } from "@/components/reflect/AskSurface";
import { brandCopy, brandFor } from "@/design/brand/brand";

// 19 Nov: Slate / Spool script (Lasso) is the default look now. This file tests the Charlotte look, which allowed
// accounts can still choose, so it pins the earlier default. The default itself is tested in slate-spool-brand.test.tsx.
vi.mock("@/lib/brand-variant-shared", async (original) => ({
  ...(await original<typeof import("@/lib/brand-variant-shared")>()),
  DEFAULT_BRAND_VARIANT: "current",
}));

const charlotte = brandFor("charlotte");

describe("brandCopy", () => {
  it("returns Lasso copy unchanged", () => {
    for (const text of ["Ask Lasso", "Close Ask Lasso", "Lasso is reading", "WHAT LASSO READS"]) {
      expect(brandCopy(brandFor("lasso"), text)).toBe(text);
    }
  });

  it("names the Ask panel and its controls Charlotte", () => {
    expect(brandCopy(charlotte, "Ask Lasso")).toBe("Charlotte");
    expect(brandCopy(charlotte, "Close Ask Lasso")).toBe("Close Charlotte");
    expect(brandCopy(charlotte, "Where Ask Lasso opens")).toBe("Where Charlotte opens");
    expect(brandCopy(charlotte, "Ask Lasso. Ask a question about the work on this board.")).toBe(
      "Charlotte. Ask a question about the work on this board.",
    );
  });

  it("keeps the invitation when a verb phrase follows, and swaps every other mention", () => {
    expect(brandCopy(charlotte, "Ask Lasso about this section")).toBe("Ask Charlotte about this section");
    expect(brandCopy(charlotte, "Lasso is reading")).toBe("Charlotte is reading");
    expect(brandCopy(charlotte, "WHAT LASSO READS")).toBe("WHAT CHARLOTTE READS");
    expect(brandCopy(charlotte, "Analyses Lasso can run on this work")).toBe("Analyses Charlotte can run on this work");
  });

  it("the hook reads the skin from context", () => {
    function Probe() {
      return <>{useBrandCopy()("Ask Lasso")}</>;
    }
    const inSkin = (skin: "lasso" | "charlotte") => render(<SkinContext.Provider value={skin}><Probe /></SkinContext.Provider>).container.textContent;
    expect(inSkin("lasso")).toBe("Ask Lasso");
    expect(inSkin("charlotte")).toBe("Charlotte");
  });
});

describe("Ask scope sentence", () => {
  const ask = { draftPointed: [], boardPickedCount: 0, engagementBrief: null, selectedItems: [{ id: "a" }], mapped: [{ id: "a" }, { id: "b" }] } as never;

  it("takes the skin's name and leaves a workstream's own name alone", () => {
    const workstream = { name: "Lasso rollout", ids: ["a"] };
    expect(askScopeSummary(ask, false, workstream).sentence).toBe("Lasso will read the 1 piece in Lasso rollout, as written.");
    expect(askScopeSummary(ask, false, workstream, "Charlotte").sentence).toBe("Charlotte will read the 1 piece in Lasso rollout, as written.");
  });
});
