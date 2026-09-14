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

  // Pass 156: the two fixed open widths became one dragged width, and the
  // WIDEN / NARROW control went away with them.
  it("keeps the closed card fixed and makes the open edge draggable", () => {
    const styles = read("src/styles.css");
    const card = read("src/components/engagements/ContextCard.tsx");
    expect(styles).toContain('data-rail="closed"] > .nb-bench-aside');
    expect(styles).toContain("width: 236px");
    expect(styles).not.toContain('data-rail="wide"]');
    expect(styles).toContain(".nb-panel-grip");
    expect(styles).toContain('.nb-bench-page[data-dragging="true"] { transition: none; }');
    expect(card).not.toContain("WIDEN");
    expect(card).not.toContain("NARROW");
    expect(card).not.toContain("panelWide");
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