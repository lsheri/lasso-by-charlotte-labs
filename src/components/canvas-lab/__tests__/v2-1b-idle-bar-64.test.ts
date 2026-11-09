// V2-1b: the idle bar is one 64 px row (grip, mark, a one-line composer, close), not a 236 px panel.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");
const surface = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
const composer = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
const idle = css.slice(css.indexOf("/* V2-1b:"), css.indexOf(".ask-draft-mark {"));

describe("V2-1b idle bar is one row", () => {
  it("lays the head's controls and the composer side by side, close last", () => {
    expect(idle).toContain(
      '.ask-draft[data-idle-bar="true"] { flex-direction: row; align-items: center; }',
    );
    expect(idle).toContain(
      '.ask-draft[data-idle-bar="true"] .ask-draft-head { display: contents; }',
    );
    expect(idle).toContain('[aria-label="Close Ask Lasso"] { order: 3;');
    expect(idle).toContain(".ask-draft-body { order: 2; flex: 1;");
  });
  it("drops the scope line, the second and third lines of the box, Continue and Past conversations", () => {
    expect(idle).toContain("[data-ask-scope-line] { display: none; }");
    expect(idle).toMatch(/textarea \{ min-height: 36px; height: 36px;/);
    expect(idle).toContain('[data-testid="continue-in-ai"] { display: none; }');
    expect(idle).toContain(".ask-draft-foot { display: none; }");
    expect(composer).toContain('<div className="mb-2" data-ask-scope-line>');
    expect(composer).toContain("data-ask-composer-pad>");
  });
  it("measures 64 px: the composer row (36 + 13 + 13) plus the shell border", () => {
    expect(idle).toContain("[data-ask-composer-pad] { padding: 13px 0 13px 4px; }");
    expect(surface).toContain("const IDLE_ROW_H = 62;");
    expect(36 + 13 + 13 + 2).toBe(64);
    const measure = surface.slice(
      surface.indexOf("const contentHeight = useCallback"),
      surface.indexOf("const topInset"),
    );
    expect(measure).toMatch(
      /if \(idleRef\.current\) \{[^]*querySelector<HTMLElement>\(":scope > \.sticky"\)[^]*return \(row\?\.offsetHeight \?\? IDLE_ROW_H\)/,
    );
  });
  it("docked to a side, the idle bar keeps its own height", () => {
    expect(surface).toContain("fitLock: () => foldedRef.current || idleRef.current,");
  });
  it("only under the idle state, which is only under ask-v2", () => {
    expect(
      idle
        .split("\n")
        .filter((l) => l.startsWith("."))
        .every((l) => l.startsWith('.ask-draft[data-idle-bar="true"]')),
    ).toBe(true);
  });
});
