import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PAGE = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const MODEL = readFileSync("src/components/canvas-lab/canvas-lab-model.ts", "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("GF1 retired board guides", () => {
  it("keeps Human judgment beside the normal add controls and on the existing save path", () => {
    const toolbar = PAGE.slice(PAGE.indexOf("const toolbarItems"), PAGE.indexOf("const toolbarPlan"));
    const addJudgment = PAGE.slice(PAGE.indexOf("function addJudgment"), PAGE.indexOf("function deleteNode"));

    expect(toolbar).toContain('data-toolbar-control="add-text"');
    expect(toolbar).toContain('data-toolbar-control="add-sticky"');
    expect(toolbar).toContain('data-toolbar-control="add-judgment"');
    expect(toolbar).toContain('aria-label="Human judgment"');
    expect(toolbar.indexOf('data-toolbar-control="add-judgment"')).toBeGreaterThan(toolbar.indexOf('data-toolbar-control="add-sticky"'));
    expect(addJudgment).toContain('kind: "judgment"');
    expect(addJudgment).toContain('frame: null');
    expect(addJudgment).toContain('lab.persist({ type: "node_create", node: input })');
    expect(addJudgment).toContain('noteWorkboardNodeCreated(orgId, "human_judgment", judgment)');
  });

  it("matches the other add controls by staying off shared read-only boards", () => {
    const addControls = PAGE.slice(PAGE.indexOf("if (canAddWork) {", PAGE.indexOf("const toolbarItems")), PAGE.indexOf("if (showExample)"));
    expect(addControls).toContain('data-toolbar-control="add-work"');
    expect(addControls).toContain('data-toolbar-control="add-judgment"');
    expect(addControls).toContain('data-toolbar-control="grouping"');
  });

  it("renders neither retired panel for named or old frames", () => {
    expect(PAGE).not.toContain("<ReasoningTrailGuide");
    expect(PAGE).not.toContain("<FoundationGuide");
    expect(PAGE).not.toContain("showGuides");
    expect(MODEL).not.toContain("BOARD_GUIDE_RECTS");
    for (const kind of ["decisions", "foundation", "outputs"]) {
      expect(PAGE).not.toContain(`frame.id === "${kind}" ? <ReasoningTrailGuide`);
    }
  });

  it("still renders named regions through the ordinary frame component", () => {
    expect(PAGE).toContain("boardFrames.filter((frame) => frame.id !== \"trail\"");
    expect(PAGE).toContain("const region = isRegionFrameId(frame.id)");
    expect(PAGE).toContain("<LabFrameElement key={frame.id}");
    expect(PAGE).toContain("region={region}");
  });

  it("contains neither retired panel title as a standalone source literal", () => {
    const retiredTrailTitle = "Reasoning " + "trail";
    const retiredStartTitle = "Start " + "here";
    const unrelatedStartCopy = new Set([
      "src/components/canvas-lab/FocusOverlay.tsx",
      "src/components/demo/DemoHomeWorkspace.tsx",
      "src/lib/__tests__/unit3-demo-tour.test.tsx",
    ]);
    const trailOffenders = sourceFiles("src").filter((path) => readFileSync(path, "utf8").includes(retiredTrailTitle));
    const startOffenders = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes(retiredStartTitle) && !unrelatedStartCopy.has(path);
    });
    expect(trailOffenders).toEqual([]);
    expect(startOffenders).toEqual([]);
  });
});