import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { askScopeSummary } from "@/components/reflect/AskSurface";

const surface = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
const draft = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

const item = (id: string) => ({ id }) as never;
const base = { draftPointed: [], boardPickedCount: 0, engagementBrief: null, selectedItems: [item("a"), item("b"), item("c")], mapped: [item("a"), item("b"), item("c")] } as never;

describe("C2: scope pill and sentence", () => {
  it("whole board", () => {
    expect(askScopeSummary(base, false)).toEqual({ pill: "Whole board", count: 3, sentence: "Lasso will read all 3 pieces of work on this board, as written." });
  });
  it("picked on the board, pointed at, a workstream, a selection", () => {
    expect(askScopeSummary({ ...(base as object), boardPickedCount: 2 } as never, true).pill).toBe("Picked");
    expect(askScopeSummary({ ...(base as object), draftPointed: [item("a")] } as never, false).sentence).toBe("Lasso will read the 1 piece you pointed at, as written.");
    expect(askScopeSummary(base, false, { name: "Pricing", ids: ["a", "b", "c"] }).pill).toBe("Pricing");
    expect(askScopeSummary({ ...(base as object), selectedItems: [item("a")] } as never, false).pill).toBe("Selected");
  });
  it("nothing readable picked never claims a read", () => {
    const none = askScopeSummary({ ...(base as object), boardPickedCount: 0 } as never, true);
    expect(none.count).toBe(0);
    expect(none.sentence).not.toMatch(/will read/);
  });
});

describe("C2: compact composer (ask-v2 dock only)", () => {
  it("one growing line, then scope pill, Continue, round Send; no read chip or scope chip", () => {
    expect(surface).toMatch(/rows=\{compact \? 1 : mobile \? 2 : 3\}/);
    expect(surface).toMatch(/<AskScopePill ask=\{ask\} workstream=\{slash\.chosen\} \/>/);
    expect(surface).toMatch(/className="ask-cc-send"\s+aria-label="Send"/);
    expect(surface).toMatch(/\{!mobile && !compact \? \(\s*<div className="mb-2" data-ask-scope-line>/);
  });
  it("grows to six lines, and an empty box drops its measured height", () => {
    expect(surface).toMatch(/Math\.min\(box\.scrollHeight, 144\)/);
    expect(surface).toMatch(/box\.style\.height = "";\s*if \(!box\.value\) return;/);
  });
  it("no 'Reading N items as written' line and no Try suggestions under ask-v2", () => {
    // ASK-V2-CLEANUP: both old pieces are deleted, not just switched off.
    expect(draft).not.toContain("beforeComposer=");
    expect(surface).not.toContain("Try: what did I decide here");
  });
  it("the dock draws the compact composer; other hosts keep the full one", () => {
    expect(draft).toMatch(/compactComposer=\{draft === "b"\}/);
    expect(surface).toMatch(/compactComposer = false,/);
  });
});

describe("C2: idle bar and collapse", () => {
  it("the capsule covers an empty chat and a collapsed one, and stays while typing until the question outgrows it (ASK-V2-FIX-1)", () => {
    expect(draft).toMatch(/const idleBar = draft === "b" && props\.tab === "messages" && \(empty \|\| folded\) && !ask\.pending && !ask\.error && !ask\.pickerOpen && !draftLong;/);
  });
  it("focused and empty, the scope sentence shows and the bar re-measures", () => {
    expect(draft).toMatch(/composerScopeLine=\{idleBar && empty && focusedIn\}/);
    expect(draft).toMatch(/\[refresh, collapsed, folded, expanded, idleBar, focusedIn\]/);
  });
  it("history sits in the row before Send; the head hides its own history and collapse", () => {
    expect(draft).toMatch(/composerRowExtra=\{idleBar \? \(\s*<button type="button" className="ask-cc-icon" aria-label="Past conversations"/);
    expect(css).toMatch(/\[aria-label="Expand Ask Lasso"\], \[aria-label="Collapse Ask Lasso"\]\) \{ display: none; \}/);
    // GRIP-1: the grip stays, small, in the corner and out of the row's flow.
    expect(css).toContain('.ask-draft[data-idle-bar="true"] .ask-draft-grip { position: absolute; left: 5px; top: 3px; z-index: 3; width: 12px; height: 15px; margin: 0; opacity: .55;');
    expect(css).not.toContain('.ask-draft[data-idle-bar="true"] .ask-draft-grip { display: none; }');
  });
  it("the Continue line never shows over the bar", () => {
    expect(draft).toMatch(/draft === "b" && !idleBar && props\.tab === "messages" && h7LineShown/);
  });
});
