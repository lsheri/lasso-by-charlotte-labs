// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LabAnswerCard, COPY } from "@/components/canvas-lab/LabAnswerCard";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const node: LabNode = { id: "answer", kind: "answer", title: "", summary: "- a\n- b", typeLabel: "Answer", ownership: "yours", local: true, authorName: "Liam", x: 0, y: 0, width: 280, height: 180 };
const props = { node, focused: false, stackZ: 1, onFocus: vi.fn(), onPointerDown: vi.fn(), onDelete: vi.fn() };
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("BE-2 kept answer display", () => {
  it("renders markdown bullets, bold and numbered lists without changing the kept line", async () => {
    render(<LabAnswerCard {...props} node={{ ...node, summary: "- a\n- **b**\n\n1. First\n2. Second" }} />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("b").tagName).toBe("STRONG");
    expect(screen.getByText("Kept by Liam")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPY.showAll })).toBeNull();
  });
  it("fades overflow and expands locally, then restores the collapsed height", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(350);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(90);
    render(<LabAnswerCard {...props} />);
    const card = screen.getByTestId("canvas-lab-answer-card");
    expect(screen.getByTestId("answer-body-fade")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: COPY.showAll }));
    expect(card.style.height).toBe("auto");
    expect(screen.queryByTestId("answer-body-fade")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY.showLess }));
    await waitFor(() => expect(card.style.height).toBe("180px"));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onPointerDown).not.toHaveBeenCalled();
  });
  it("replaces the border with one selected outline and uses token colours", () => {
    render(<LabAnswerCard {...props} focused />);
    expect(screen.getByTestId("canvas-lab-answer-card").dataset.focused).toBe("true");
    const css = readFileSync("src/styles.css", "utf8");
    const rule = css.match(/\.canvas-lab-answer-card\[data-focused="true"\]\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain("border-color: transparent");
    expect(rule).toContain("outline: 2.4px solid var(--nb-lasso-green)");
    const answerRules = css.slice(css.indexOf("/* A kept answer:"), css.indexOf(".canvas-lab-drop-prompt"));
    expect(answerRules).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(COPY).toEqual({ showAll: "Show all", showLess: "Show less" });
  });
});