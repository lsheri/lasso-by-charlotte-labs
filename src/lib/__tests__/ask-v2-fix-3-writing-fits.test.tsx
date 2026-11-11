// @vitest-environment jsdom
// ASK-V2-FIX-3 (10 Nov, measured live): in the 295 px dock the answer began streaming at 336 px, under the fold,
// behind 56 px of binder padding above and below the chips. Once writing starts the chips fold to one receipt line.
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AskReadingV2, ASK_READING_V2_STYLES } from "@/components/reflect/AskReadingV2";
import type { ContextManifest, ManifestItem } from "@/lib/context-manifest";

afterEach(() => cleanup());

const conv = (id: string): ManifestItem => ({ id, title: `Chat ${id}`, kind: "conversation", detail: "turns 1-12", chars_in: 900, chars_total: 900 });
const manifest: ContextManifest = {
  engagement: null,
  brief_included: false,
  firm_checks_applied: 0,
  items: [conv("a"), conv("b"), conv("c")],
  excluded: [],
  assembled_at: "2026-11-10T23:00:00Z",
};

describe("ASK-V2-FIX-3 the answer streams in view", () => {
  it("in the dock, writing folds the chips to one receipt line", () => {
    render(<AskReadingV2 manifest={manifest} streamed="The break-even" pickedCount={0} statusInTitle />);
    expect(screen.getByTestId("ask-v2-writing-receipt").textContent).toBe("Read 3 of 3");
    expect(screen.queryByTestId("ask-v2-chips")).toBeNull();
  });
  it("while reading, the chips stay", () => {
    render(<AskReadingV2 manifest={manifest} streamed="" pickedCount={0} statusInTitle />);
    expect(screen.getByTestId("ask-v2-chips")).toBeTruthy();
    expect(screen.queryByTestId("ask-v2-writing-receipt")).toBeNull();
  });
  it("the phone sheet (no title bar) keeps the chips while writing", () => {
    render(<AskReadingV2 manifest={manifest} streamed="The" pickedCount={0} />);
    expect(screen.getByTestId("ask-v2-chips")).toBeTruthy();
  });
  it("the working card drops the binder's baseline padding in the dock only", () => {
    expect(ASK_READING_V2_STYLES).toContain(".nb-binder-inset.ask-v2-inset { padding: 4px 0; margin: 4px 0 8px; box-shadow: none; }");
    const surface = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
    expect(surface).toContain('className={askV2 ? "nb-binder-inset ask-v2-inset" : "nb-binder-inset"}');
  });
});

describe("Keyboard collapse edge case (9 Nov handoff item 4), already fixed in fb18427", () => {
  it("pressing the box while the chat is folded unfolds it, even when focus never left the box", () => {
    const dock = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(dock).toContain("if (event.target instanceof HTMLTextAreaElement && foldedRef.current) setFolded(false);");
  });
});
