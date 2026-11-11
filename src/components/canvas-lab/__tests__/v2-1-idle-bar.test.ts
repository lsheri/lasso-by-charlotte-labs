// V2-1 (A1): behind ask-v2, an unused Ask is one slim row; clicking in brings back the scope line.
// Rule 1 (8 Nov): no new design state may prime. Focus, opening the scope line and hover never call primeNow.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const surface = read("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx");
const css = read("src/styles.css");
const hook = read("src/components/reflect/use-ask-lasso.ts");

describe("V2-1 idle bar", () => {
  // C2 (9 Nov): the agreed capsule stays while you type into an empty chat (the scope sentence shows under
  // it) and a collapsed chat returns to it; clicking into a collapsed chat unfolds it.
  it("is only on behind ask-v2, empty or collapsed, and never while a question is in flight", () => {
    expect(surface).not.toContain('askV2');
    expect(surface).toContain('const idleBar = draft === "b" && props.tab === "messages" && (empty || folded) && !ask.pending && !ask.error && !ask.pickerOpen && !draftLong;');
    expect(surface).toContain('data-idle-bar={idleBar ? "true" : undefined}');
    expect(surface).toContain("onFocusCapture={(event) => { setFocusedIn(true);");
  });

  it("never primes from focus, blur or hover: the only prime path is typing", () => {
    const focus = surface.slice(surface.indexOf("onFocusCapture="), surface.indexOf("onBlurCapture=") + 200);
    expect(focus).not.toMatch(/prime/i);
    expect(surface).not.toMatch(/onMouseEnter[^\n]*prime|onPointerEnter[^\n]*prime/i);
    expect(surface).not.toContain("primeNow(");
    const onDraft = hook.slice(hook.indexOf("function onDraftChange"), hook.indexOf("function onDraftChange") + 600);
    expect(onDraft).toContain("shouldPrimeForDraft(");
    expect(onDraft).toContain("primeNow(");
  });

  it("hides everything but the composer, and the hidden parts drop out of the measured height", () => {
    expect(css).toContain('.ask-draft[data-idle-bar="true"] .ask-draft-body > :not(.sticky) { display: none; }');
    expect(surface).toContain('if (cs.display === "none") continue;');
    expect(surface).toContain("useLayoutEffect(() => { refresh(); }, [refresh, collapsed, folded, expanded, idleBar, focusedIn]);");
  });
});
