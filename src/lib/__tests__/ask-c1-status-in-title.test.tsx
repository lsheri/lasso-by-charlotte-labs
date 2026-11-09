// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AskReadingV2, AskTitleStatus } from "@/components/reflect/AskReadingV2";

const manifest = { version: 1, items: [] } as never;

describe("C1: the status sits in the title bar", () => {
  it("shows the phase word, a clock and a progress line keyed to the phase", () => {
    const { rerender } = render(<AskTitleStatus turnKey="t1" manifest={null} streamed="" />);
    expect(screen.getByTestId("ask-title-status").textContent).toMatch(/^Gathering0:0\d$/);
    expect(screen.getByTestId("ask-title-prog").getAttribute("data-phase")).toBe("gathering");
    rerender(<AskTitleStatus turnKey="t1" manifest={manifest} streamed="" />);
    expect(screen.getByTestId("ask-title-prog").getAttribute("data-phase")).toBe("reading");
    rerender(<AskTitleStatus turnKey="t1" manifest={manifest} streamed="Yes" />);
    expect(screen.getByTestId("ask-title-status").getAttribute("data-phase")).toBe("writing");
  });
  it("the thread drops its own status row and step line when the title bar has them", () => {
    render(<AskReadingV2 manifest={null} streamed="" pickedCount={0} statusInTitle />);
    expect(screen.queryByTestId("ask-v2-status")).toBeNull();
    expect(screen.queryByTestId("ask-v2-steps")).toBeNull();
    expect(screen.getByTestId("ask-v2-chips")).toBeTruthy();
  });
  it("without the title bar (phone sheet), the thread keeps both", () => {
    render(<AskReadingV2 manifest={null} streamed="" pickedCount={0} />);
    expect(screen.getByTestId("ask-v2-status")).toBeTruthy();
    expect(screen.getByTestId("ask-v2-steps")).toBeTruthy();
  });
  it("only the ask-v2 dock wires it, only while an answer is in flight", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(src).toMatch(/\{draft === "b" && askV2 && ask\.pending \? \(\s*<AskTitleStatus turnKey=\{turnKey\}/);
    expect(src).toMatch(/statusInTitle=\{draft === "b" && askV2\}/);
  });
  it("the line sweeps while gathering, holds while reading, creeps but never finishes while writing", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.ask-draft-prog\[data-phase="gathering"\] > i \{[^}]*animation: ask-prog-sweep/);
    expect(css).toMatch(/@keyframes ask-prog-creep \{ from \{ width: 70%; \} to \{ width: 95%; \} \}/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.ask-draft-status-word/);
  });
});
