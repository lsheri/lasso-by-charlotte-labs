// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { CoverageNote, compactCoverageLine } from "@/components/reflect/CoverageNote";

afterEach(cleanup);

describe("V2-2e the note under a receipt says only what the receipt does not", () => {
  it("the small board: receipt 'Read 1 of 3'; the note explains the other two", () => {
    expect(compactCoverageLine({ summaryCount: 0, noTextCount: 2, share: 1 })).toBe(
      "2 items with no stored text.",
    );
  });
  it("never repeats how many were read as written", () => {
    const line = compactCoverageLine({ summaryCount: 1, noTextCount: 1, share: 0.5 });
    expect(line).toBe(
      "1 item read as summary only. 1 item with no stored text. 50% of the selected text was in front of Lasso.",
    );
    expect(line).not.toMatch(/as written/);
  });
  it("a cut still shows on its own; a full read adds nothing", () => {
    expect(compactCoverageLine({ summaryCount: 0, noTextCount: 0, share: 0.8 })).toBe(
      "80% of the selected text was in front of Lasso.",
    );
    expect(compactCoverageLine({ summaryCount: 0, noTextCount: 0, share: 1 })).toBeNull();
    expect(compactCoverageLine({ summaryCount: 0, noTextCount: 0, share: 0.999 })).toBeNull();
  });
  it("renders compact only when asked; the full note is unchanged", () => {
    render(<CoverageNote fullCount={1} summaryCount={0} noTextCount={2} share={1} compact />);
    expect(screen.getByTestId("coverage-note").textContent).toBe("2 items with no stored text.");
    cleanup();
    render(<CoverageNote fullCount={1} summaryCount={0} noTextCount={2} share={1} />);
    expect(screen.getByTestId("coverage-note").textContent).toBe(
      "Read as written: 1 item. No stored text: 2 items. 100% of the selected text was in front of Lasso.",
    );
  });
  it("plain words, no em dash", () => {
    const src = readFileSync("src/components/reflect/CoverageNote.tsx", "utf8");
    expect(src).not.toMatch(/—/);
  });
});

describe("V2-2e wiring", () => {
  it("the note under a saved answer is compact under ask-v2 only; the in-flight note is unchanged", () => {
    const src = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
    expect(src).toContain("<CoverageNote {...coverage} compact={askV2 && Boolean(manifest)} />");
    expect(src).toContain("<CoverageNote {...ask.coverage} />");
  });
});
