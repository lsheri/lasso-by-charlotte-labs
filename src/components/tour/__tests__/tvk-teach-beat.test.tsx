// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourStage, type TourActRenderer } from "@/components/tour/TourStage";
import { TourActPush, TOUR_TURN_DELAY_MS } from "@/components/tour/TourActs";
import { TourTeachBeatContext } from "@/components/tour/tour-beat";
import { TOUR_CONTENT, type TourActId } from "@/lib/tour-content";

let reduce = false;
beforeEach(() => {
  reduce = false;
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("reduced-motion") ? reduce : false,
    media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("tour-stage")) return { left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 } as DOMRect;
    if (this.hasAttribute("data-tour-do")) return { left: 20, top: 80, right: 320, bottom: 120, width: 300, height: 40 } as DOMRect;
    if (this.hasAttribute("data-tour-target")) return { left: 600, top: 300, right: 720, bottom: 350, width: 120, height: 50 } as DOMRect;
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const acts: readonly TourActRenderer[] = Array.from({ length: 8 }, (_, index) => ({
  id: (index + 1) as TourActId,
  content: createElement("button", { "data-tour-target": String(index + 1) }, `Act ${index + 1}`),
}));
const props = (activeAct: TourActId, onSkip = vi.fn()) => ({ register: "company" as const, activeAct, acts, onSkip, onBack: vi.fn(), onHintShown: vi.fn() });
const liveTargets = (root: HTMLElement) => Array.from(root.querySelectorAll("[data-tour-target]")).filter((el) => !el.closest("[inert]"));

describe("TVk teach beat", () => {
  it("opens every act in the teach beat with the callout, Got it, no live target and no arrow", async () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const r = render(createElement(TourStage, props(id)));
      const callout = r.container.querySelector(".tour-teaching-callout.is-teaching") as HTMLElement;
      expect(callout.querySelector("p")?.textContent).toBe(TOUR_CONTENT.company.acts[id - 1]?.why);
      const gotIt = within(callout).getByRole("button", { name: "Got it" });
      expect(document.activeElement).toBe(gotIt);
      expect(liveTargets(r.container)).toHaveLength(0);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(r.container.querySelector(".tour-instruction-arrow path")).toBeNull();
      r.unmount();
    }
  });

  const dismissals: Array<[string, (root: HTMLElement) => void]> = [
    ["Got it", (root) => fireEvent.click(within(root).getByRole("button", { name: "Got it" }))],
    ["Enter", () => fireEvent.keyDown(window, { key: "Enter" })],
    ["Space", () => fireEvent.keyDown(window, { key: " " })],
    ["Escape", () => fireEvent.keyDown(window, { key: "Escape" })],
    ["the dimmed surface", (root) => fireEvent.click(root.querySelector('[data-testid="tour-teach-scrim"]') as HTMLElement)],
  ];
  for (const [name, dismiss] of dismissals) {
    it(`moves to the do beat by ${name}`, async () => {
      const onSkip = vi.fn();
      const r = render(createElement(TourStage, props(3, onSkip)));
      dismiss(r.container);
      expect(onSkip).not.toHaveBeenCalled();
      expect(r.container.querySelector('.tour-stage[data-beat="do"]')).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
      expect(liveTargets(r.container)).toHaveLength(1);
      await waitFor(() => expect(r.container.querySelectorAll(".tour-instruction-arrow path")).toHaveLength(3));
    });
  }

  it("glows and draws the arrow in the do beat, except act eight draws none", async () => {
    const r = render(createElement(TourStage, props(8)));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(liveTargets(r.container).map((el) => el.getAttribute("data-tour-target"))).toEqual(["8"]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(r.container.querySelector(".tour-instruction-arrow")).toBeNull();
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain('.tour-stage[data-beat="teach"] [data-tour-target] { outline: none; box-shadow: none; animation: none; }');
  });

  it("holds act one's shared timer during the teach beat and starts it after", () => {
    vi.useFakeTimers();
    const view = (teaching: boolean) => createElement(TourTeachBeatContext.Provider, { value: teaching }, createElement(TourActPush, { register: "company", onReady: vi.fn() }));
    const r = render(view(true));
    const turns = () => r.container.querySelectorAll(".tour-chat-window li, .tour-chat-window [data-turn]").length;
    const before = r.container.innerHTML;
    act(() => { vi.advanceTimersByTime(TOUR_TURN_DELAY_MS * 12); });
    expect(r.container.innerHTML).toBe(before);
    r.rerender(view(false));
    act(() => { vi.advanceTimersByTime(TOUR_TURN_DELAY_MS * 12); });
    expect(r.container.innerHTML).not.toBe(before);
    expect(r.container.querySelectorAll('[data-tour-target="1"]')).toHaveLength(2);
    void turns;
  });

  it("does not re-gate an act already read when going back", () => {
    const r = render(createElement(TourStage, props(2)));
    fireEvent.keyDown(window, { key: "Enter" });
    r.rerender(createElement(TourStage, props(3)));
    expect(r.container.querySelector('.tour-stage[data-beat="teach"]')).toBeTruthy();
    fireEvent.keyDown(window, { key: "Enter" });
    r.rerender(createElement(TourStage, props(2)));
    expect(r.container.querySelector('.tour-stage[data-beat="do"]')).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  });

  it("shows the teach beat with no animation under reduced motion", () => {
    reduce = true;
    const r = render(createElement(TourStage, props(4)));
    expect(r.container.querySelector('.tour-stage[data-beat="teach"]')).toBeTruthy();
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.tour-act, \.tour-stage-actions, \.tour-teaching-callout \{ transition: none !important; \}\s*\.tour-teach-scrim \{ animation: none !important; \}\s*\.tour-teaching-callout\.is-teaching \{ transform: none; \}/);
  });

  it("blurs and dims only the act surface, never the heading or counter", () => {
    const r = render(createElement(TourStage, props(5)));
    expect(r.container.querySelector(".tour-act")?.hasAttribute("inert")).toBe(true);
    expect(r.container.querySelector(".tour-stage-actions")?.hasAttribute("inert")).toBe(true);
    expect(r.container.querySelector(".tour-instruction-band")?.closest("[inert]")).toBeNull();
    expect(r.container.querySelector(".tour-step-marker")?.closest("[inert]")).toBeNull();
    expect(r.container.querySelector(".tour-rail")?.closest("[inert]")).toBeNull();
    const css = readFileSync("src/styles.css", "utf8");
    const blurRule = css.match(/([^{}]+)\{ filter: blur\(2px\) saturate\(0\.85\); \}/);
    expect(blurRule?.[1]?.trim()).toBe('.tour-stage[data-beat="teach"] .tour-act,\n.tour-stage[data-beat="teach"] .tour-stage-actions');
    expect(css).not.toMatch(/\.tour-(instruction-band|step-marker|stage-header|rail)[^{]*\{[^}]*filter: blur/);
  });
});
