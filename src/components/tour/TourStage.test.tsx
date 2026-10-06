// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourStage, type TourActRenderer } from "@/components/tour/TourStage";
import { TOUR_CONTENT } from "@/lib/tour-content";

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

const acts: readonly TourActRenderer[] = Array.from({ length: 8 }, (_, index) => ({
  id: (index + 1) as TourActRenderer["id"],
  content: createElement("button", { "data-tour-target": String(index + 1) }, `Act ${index + 1}`),
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
    expect(screen.getByText("Draw a box around the three selected cards.")).toBeTruthy();
    const teaching = screen.getByText("We are deciding that these pieces of work should share the same context.");
    expect(teaching.classList.contains("tour-teaching-callout")).toBe(true);
    expect(within(container.querySelector(".tour-instruction-band") as HTMLElement).queryByText(teaching.textContent ?? "")).toBeNull();
    expect(container.querySelector("[data-tour-do]")).toBeTruthy();
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
    expect(screen.getByText("Tap the Claude chat to put it on the board.")).toBeTruthy();
  });

  it("renders every unchanged teaching sentence in the callout rather than the instruction band", () => {
    for (const activeAct of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const rendered = render(createElement(TourStage, { register: "company", activeAct, acts, onSkip: vi.fn(), onBack: vi.fn(), onHintShown: vi.fn() }));
      const callout = rendered.container.querySelector(".tour-teaching-callout");
      const band = rendered.container.querySelector(".tour-instruction-band");
      expect(callout?.textContent).toBe(TOUR_CONTENT.company.acts[activeAct - 1]?.why);
      expect(band?.textContent).not.toContain(TOUR_CONTENT.company.acts[activeAct - 1]?.why);
      expect(band?.querySelector("[data-tour-do]")).toBeTruthy();
      rendered.unmount();
    }
  });

  it("calls the required Skip handler", () => {
    const onSkip = vi.fn();
    render(stage(onSkip));
    fireEvent.click(screen.getByRole("button", { name: "Skip the tour" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("resolves an instruction arrow path for acts one to seven and draws none on act eight", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("tour-stage")) return { left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 } as DOMRect;
      if (this.hasAttribute("data-tour-do")) return { left: 20, top: 80, right: 320, bottom: 120, width: 300, height: 40 } as DOMRect;
      if (this.hasAttribute("data-tour-target")) return { left: 600, top: 300, right: 720, bottom: 350, width: 120, height: 50 } as DOMRect;
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
    });
    for (const activeAct of [1, 2, 3, 4, 5, 6, 7] as const) {
      const rendered = render(createElement(TourStage, { register: "company", activeAct, acts, onSkip: vi.fn(), onBack: vi.fn(), onHintShown: vi.fn() }));
      await waitFor(() => expect(rendered.container.querySelectorAll(".tour-instruction-arrow path")).toHaveLength(3));
      rendered.unmount();
    }
    const finale = render(createElement(TourStage, { register: "company", activeAct: 8, acts, onSkip: vi.fn(), onBack: vi.fn(), onHintShown: vi.fn() }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(finale.container.querySelector('[data-tour-target="8"]')).toBeTruthy();
    expect(finale.container.querySelector(".tour-instruction-arrow")).toBeNull();
    finale.unmount();
  });

  it("derives the active glow from target attributes and keeps reduced motion static", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain('.tour-shell[data-act="1"] [data-tour-target="1"]');
    expect(css).toContain('.tour-shell[data-act="8"] [data-tour-target="8"]');
    expect(css).toContain("outline: 2px solid var(--nb-lasso-green)");
    expect(css).toContain("animation: tour-target-glow 2s ease-in-out infinite");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\[data-tour-target\] \{ animation: none; \}/);
  });
});