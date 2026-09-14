import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("pass 151 unit 2", () => {
  it("keeps only Messages, History, and New chat in the chat tab row", () => {
    const surface = read("src/components/reflect/AskSurface.tsx");
    const state = read("src/components/reflect/ask-dock-state.tsx");
    const hook = read("src/components/reflect/use-ask-lasso.ts");
    expect(surface).not.toContain('id: "analyses"');
    expect(surface).not.toContain("AnalysesTab");
    expect(surface).not.toContain("SelectionAnalysisChips");
    expect(state).toContain('export type AskTab = "messages" | "history";');
    expect(hook).not.toContain("useChatAnalyses");
    expect(hook).not.toContain("analyses,");
  });

  it("uses the three fixed rail widths and labels the width control", () => {
    const styles = read("src/styles.css");
    const card = read("src/components/engagements/ContextCard.tsx");
    expect(styles).toContain('data-rail="closed"] > .nb-bench-aside');
    expect(styles).toContain("width: 236px");
    expect(styles).toContain('data-rail="open"] { grid-template-columns: minmax(0, 1fr) 380px; }');
    expect(styles).toContain('data-rail="wide"] { grid-template-columns: minmax(0, 1fr) 570px; }');
    expect(card).toContain('panelWide ? "← NARROW" : "WIDEN →"');
    expect(card).toContain('panelWide ? "Narrow this column" : "Widen this column"');
  });

  it("layers custom marks above the disc and removes the pencil mark from layout flow", () => {
    const sourceMark = read("src/components/work/SourceMark.tsx");
    const mapButton = read("src/components/work/MapButton.tsx");
    expect(sourceMark).toContain('disc ? "relative block" : className');
    expect(sourceMark).toContain("if (!key || !visible) return null");
    expect(mapButton).toContain("absolute left-1/2 top-full");
    expect(mapButton).toContain("pointer-events-none");
    expect(mapButton).toContain("aria-hidden");
  });
});