// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";
import { noteWorkboardDropPromptAnswered } from "@/components/canvas-lab/canvas-lab-telemetry";
import { resizeLabRect } from "@/components/canvas-lab/canvas-lab-model";
import { ZOOM_MIN, workboardPinchZoom } from "@/lib/canvas-zoom";
import { logEvent } from "@/lib/telemetry";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

const read = (path: string) => readFileSync(path, "utf8");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("polish 2b-vi", () => {
  it("a trackpad pinch moves the view, a mouse notch stays inside the clamp", () => {
    let zoom = ZOOM_MIN + 0.2;
    const start = zoom;
    for (let i = 0; i < 10; i += 1) zoom = workboardPinchZoom(zoom, -5, 0);
    expect(zoom).toBeGreaterThanOrEqual(start * 1.5);
    const notch = workboardPinchZoom(1, -100, 0);
    expect(notch).toBeLessThanOrEqual(1.18);
    expect(notch).toBeGreaterThan(1);
    expect(workboardPinchZoom(1, 100, 0)).toBeGreaterThanOrEqual(0.85);
  });

  it("a south-east resize never moves the card's top-left", () => {
    const rect = resizeLabRect({ x: 704, y: 200, width: 232, height: 112 }, "se", { x: 44, y: 30 });
    expect(rect.x).toBe(704);
    expect(rect.y).toBe(200);
    expect(rect.width).toBe(276);
  });

  it("the paper fills the card rect", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    const { container } = render(<LabCard node={{ id: "n", kind: "judgment", frame: "f", title: "Judgment", summary: "Reason", typeLabel: "judgment", ownership: "draft", local: true, x: 0, y: 0, width: 400, height: 300 }} selected focused={false} connecting={false} connectSourceAnchor={null} canResize onSelect={() => undefined} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onFocus={() => undefined} onKeyDown={() => undefined} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} />);
    const card = container.querySelector<HTMLElement>(".canvas-lab-card")!;
    expect(card.style.width).toBe("400px");
    expect(card.style.height).toBe("300px");
    const paper = container.querySelector<HTMLElement>(".canvas-lab-card-paper")!;
    expect(paper.className).toContain("h-full");
    expect(paper.className).toContain("w-full");
    const styles = read("src/styles.css");
    expect(styles).toMatch(/\.canvas-lab-card-paper > \.nb-paper \{[^}]*height: 100%;/s);
    expect(styles).toMatch(/\.canvas-lab-folded-note::after \{[^}]*bottom: -1px;/s);
    expect(styles).toContain('.canvas-lab-card[data-size="expanded"] .canvas-lab-card-paper p');
  });

  it("every ending of the move prompt is answered once", () => {
    for (const answer of ["yes", "keep", "dismissed"] as const) noteWorkboardDropPromptAnswered("org", answer);
    expect(vi.mocked(logEvent).mock.calls.map((call) => [call[0], call[2]])).toEqual([
      ["workboard.drop_prompt_answered", { answer: "yes" }],
      ["workboard.drop_prompt_answered", { answer: "keep" }],
      ["workboard.drop_prompt_answered", { answer: "dismissed" }],
    ]);
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain('closeDropPrompt("yes")');
    expect(page).toContain('closeDropPrompt("keep")');
    expect(page).toContain('closeDropPrompt("dismissed")');
    // Only the one closer clears the prompt, so no ending goes uncounted.
    expect(page.split("setDropPrompt(null)").length - 1).toBe(1);
  });
});
