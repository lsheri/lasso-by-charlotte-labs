import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const surface = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
const mark = readFileSync("src/components/reflect/LassoThinkingMark.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

describe("R7 Ask Lasso thinking marks", () => {
  it("uses the signature mark in the toolbar and removes the old CSS drift", () => {
    const toolbar = page.slice(page.indexOf("const toolbarItems"), page.indexOf("const toolbarPlan"));
    // BI-2c-ii: thinking in the toolbar means the animated lime working motion, never a settled frame.
    expect(toolbar).toContain('<LassoThinkingMark kind="signature" size={LOOP_SIZE_TOOLBAR} thinking persistent />');
    expect(toolbar).not.toContain("still");
    // The still setting stays on the component for any surface that needs one settled frame.
    expect(mark).toContain("still?: boolean;");
    expect(mark).toContain("if (still) {");
    expect(toolbar).not.toContain("canvas-lab-ask-drift");
    expect(css).not.toMatch(/canvas-lab-ask-(?:drift|float|tilt)/);
  });

  it("places one signature in the shared panel header and reuses the sidebar loop for replies", () => {
    expect(surface).toContain('import { LassoLoopMark } from "@/components/layout/LassoLoopMark"');
    const header = surface.slice(surface.indexOf("<header"), surface.indexOf("</header>"));
    const messages = surface.slice(surface.indexOf("function MessagesTab"), surface.indexOf("const HISTORY_DEFAULT_SHOWN"));
    expect(header).toContain('kind="signature"');
    expect(header).toContain("size={LOOP_SIZE_CHAT}");
    expect(surface.match(/kind="signature"/g)).toHaveLength(1);
    expect(messages).not.toContain('kind="signature"');
    expect(surface).toContain('<LassoLoopMark className="size-7 shrink-0 text-lasso-green" />');
    expect(surface).toContain('{assistant ? "Lasso" : "You"}');
  });

  it("reads Lasso lime from its existing token rather than a literal", () => {
    expect(mark).toContain('getPropertyValue("--nb-lasso-green")');
    expect(mark).not.toContain("#04f85b");
  });
});
describe("BOARD-UX-3 persistent mark stays opt-in", () => {
  it("passes persistent only on the board toolbar Ask control", () => {
    for (const file of [
      "src/components/home/HomeBoard.tsx",
      "src/components/reflect/ContextTrail.tsx",
      "src/components/reflect/AskThinkingFoot.tsx",
      "src/components/reflect/AskSurface.tsx",
      "src/components/demo/DemoWorkboardSandbox.tsx",
      "src/components/tour/TourActs.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("<LassoThinkingMark");
      expect(source).not.toMatch(/<LassoThinkingMark[^>]*\bpersistent\b/);
    }
  });
});
