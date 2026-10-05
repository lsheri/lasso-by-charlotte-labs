// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourStage, type TourActRenderer } from "@/components/tour/TourStage";

let width = 1280;

beforeEach(() => {
  width = 1280;
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("max-width") ? width < 768 : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const acts: readonly TourActRenderer[] = Array.from({ length: 7 }, (_, index) => ({
  id: (index + 1) as TourActRenderer["id"],
  content: createElement("div", null, `Act ${index + 1}`),
}));

function stage(onSkip = vi.fn()) {
  return createElement(TourStage, {
    register: "company",
    activeAct: 5,
    acts,
    onSkip,
    onBack: vi.fn(),
    onHintShown: vi.fn(),
  });
}

describe("T2 tour stage", () => {
  it("shows four drawn checks and the pointer instruction at act five", () => {
    const { container } = render(stage());
    expect(container.querySelectorAll('[data-state="complete"] .nb-mark')).toHaveLength(4);
    expect(screen.getByText("Draw a box around them.")).toBeTruthy();
    expect(screen.getByText("The box is a workstream. Everything inside it shares context, so a question answers from those pieces and nothing else on the board.")).toBeTruthy();
  });

  it("uses the touch caption at a touch-width viewport", () => {
    width = 390;
    render(
      createElement(TourStage, {
        register: "company",
        activeAct: 3,
        acts,
        onSkip: vi.fn(),
        onBack: vi.fn(),
        onHintShown: vi.fn(),
      }),
    );
    expect(screen.getByText("Tap the chat to put it on the board.")).toBeTruthy();
  });

  it("calls the required Skip handler", () => {
    const onSkip = vi.fn();
    render(stage(onSkip));
    fireEvent.click(screen.getByRole("button", { name: "Skip the tour" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});