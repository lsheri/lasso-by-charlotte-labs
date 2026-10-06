// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, useState } from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourStage, type TourActRenderer } from "@/components/tour/TourStage";
import { TourActPush, TOUR_TURN_DELAY_MS, useTourActRenderers } from "@/components/tour/TourActs";
import { TOUR_CONTENT, actById, type TourActId } from "@/lib/tour-content";

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

const spies = { advance: vi.fn(), finish: vi.fn(), skip: vi.fn() };
function Harness({ start }: { start: TourActId }) {
  const [activeAct, setActiveAct] = useState<TourActId>(start);
  const { renderers, instructionOverride, hint } = useTourActRenderers({
    register: "company", activeAct,
    onAdvance: (from) => { spies.advance(from); setActiveAct((from + 1) as TourActId); },
    onHintShown: () => undefined, onFinish: spies.finish,
  });
  return <TourStage register="company" activeAct={activeAct} acts={renderers} onSkip={spies.skip} onBack={() => setActiveAct((a) => Math.max(1, a - 1) as TourActId)} onHintShown={hint} instructionOverride={instructionOverride} />;
}
const callout = (root: HTMLElement) => root.querySelector<HTMLElement>(".tour-teaching-callout");
const stage = (root: HTMLElement) => root.querySelector<HTMLElement>(".tour-stage");

describe("TVL teach beat at the end of each act", () => {
  beforeEach(() => { spies.advance.mockReset(); spies.finish.mockReset(); spies.skip.mockReset(); });

  it("opens acts 1 to 7 with no callout, a live target and a drawn arrow", async () => {
    reduce = true;
    for (const id of [1, 2, 3, 4, 5, 6, 7] as const) {
      const r = render(<Harness start={id} />);
      expect(callout(r.container)).toBeNull();
      expect(stage(r.container)?.getAttribute("data-beat")).toBe("do");
      expect(r.container.querySelector(`.tour-act [data-tour-target="${id}"]`)).toBeTruthy();
      await waitFor(() => expect(r.container.querySelectorAll(".tour-instruction-arrow path")).toHaveLength(3));
      r.unmount();
    }
  });

  it("act one completes on both pushes: callout, blur, Got it, no self advance, then advances on its control", () => {
    reduce = true;
    vi.useFakeTimers();
    const r = render(<Harness start={1} />);
    for (const push of screen.getAllByRole("button", { name: "Push to Lasso" })) fireEvent.click(push);
    expect(stage(r.container)?.getAttribute("data-beat")).toBe("teach");
    expect(r.container.querySelector(".tour-act")?.hasAttribute("inert")).toBe(true);
    expect(callout(r.container)?.querySelector("p")?.textContent).toBe(TOUR_CONTENT.company.acts[0]?.why);
    const control = within(callout(r.container)!).getByRole("button");
    expect(control.textContent).toBe("Got it");
    expect(document.activeElement).toBe(control);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(spies.advance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("tour-teach-scrim"));
    expect(spies.advance).not.toHaveBeenCalled();
    fireEvent.click(control);
    expect(spies.advance).toHaveBeenCalledWith(1);
    expect(callout(r.container)).toBeNull();
  });

  it("act seven completes on Keep and its control carries the founder's label", () => {
    reduce = true;
    const r = render(<Harness start={7} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    const control = within(callout(r.container)!).getByRole("button");
    expect(control.textContent).toBe(actById("company", 7)?.primaryActionLabel);
    expect(spies.advance).not.toHaveBeenCalled();
    fireEvent.click(control);
    expect(spies.advance).toHaveBeenCalledWith(7);
  });

  it("act eight has no completing action, so it never shows a callout; its footer control finishes the tour", async () => {
    const r = render(<Harness start={8} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(callout(r.container)).toBeNull();
    expect(r.container.querySelector(".tour-teach-scrim")).toBeNull();
    expect(stage(r.container)?.getAttribute("data-beat")).toBe("do");
    expect(within(r.container).queryByRole("button", { name: "Got it" })).toBeNull();
    const footer = r.container.querySelector(".tour-stage-actions") as HTMLElement;
    const control = within(footer).getByRole("button", { name: actById("company", 8)?.primaryActionLabel ?? "" });
    fireEvent.click(control);
    expect(spies.finish).toHaveBeenCalledTimes(1);
    // No interaction can bring a callout up: the board, the scrim area and keys change nothing.
    fireEvent.click(r.container.querySelector('[data-testid="tour-act"]') as HTMLElement);
    fireEvent.keyDown(window, { key: "Enter" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(callout(r.container)).toBeNull();
  });

  it("the no-callout rule follows hasAction, not a hardcoded act id", () => {
    const base: TourActRenderer[] = Array.from({ length: 8 }, (_, index) => ({
      id: (index + 1) as TourActId,
      content: <span />,
      complete: true,
    }));
    // A completed act five with no action shows no callout.
    const noAction = base.map((item) => (item.id === 5 ? { ...item, hasAction: false } : item));
    const r5 = render(createElement(TourStage, { register: "company", activeAct: 5, acts: noAction, onSkip: vi.fn(), onBack: vi.fn(), onHintShown: vi.fn() }));
    expect(callout(r5.container)).toBeNull();
    r5.unmount();
    // A completed act eight that declares an action still shows its callout.
    const withAction = base.map((item) => (item.id === 8 ? { ...item, hasAction: true, onContinue: vi.fn() } : item));
    const r8 = render(createElement(TourStage, { register: "company", activeAct: 8, acts: withAction, onSkip: vi.fn(), onBack: vi.fn(), onHintShown: vi.fn() }));
    expect(callout(r8.container)).not.toBeNull();
    r8.unmount();
  });

  it("act eight's why string is untouched in tour-content.ts", () => {
    const source = readFileSync("src/lib/tour-content.ts", "utf8");
    expect(source).toContain('why: "The deck is what the client sees. Every line in it can still point at the chat or file it came from.",');
    expect(actById("company", 8)?.why).toBe("The deck is what the client sees. Every line in it can still point at the chat or file it came from.");
  });

  it("labels each act's control with its primaryActionLabel, else Got it", () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const expected = actById("company", id)?.primaryActionLabel ?? "Got it";
      expect(expected).toBe(id === 7 ? "See it in the deck" : id === 8 ? "Start with my own work" : "Got it");
    }
  });

  it("renders no primary action in the stage footer for acts with an action; act eight's finish control lives there", () => {
    for (const id of [1, 7, 8] as const) {
      const r = render(<Harness start={id} />);
      const footer = r.container.querySelector(".tour-stage-actions") as HTMLElement;
      expect(footer.querySelector(".tour-primary-action")).toBeNull();
      const labels = within(footer).queryAllByRole("button").map((b) => b.textContent);
      expect(labels).toEqual(id === 8 ? ["Back", "Start with my own work"] : id > 1 ? ["Back"] : []);
      r.unmount();
    }
  });

  it("Escape still skips the tour, including while the callout shows", () => {
    render(<Harness start={8} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(spies.skip).toHaveBeenCalledTimes(1);
    expect(spies.finish).not.toHaveBeenCalled();
  });

  it("Back opens the previous act in its doing state with no callout", () => {
    reduce = true;
    const r = render(<Harness start={8} />);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(callout(r.container)).toBeNull();
    expect(screen.getByRole("button", { name: "Keep" })).toBeTruthy();
  });

  it("runs act one's conversation timer from the moment the act opens", () => {
    vi.useFakeTimers();
    const r = render(<TourActPush register="company" onReady={vi.fn()} />);
    const before = r.container.innerHTML;
    act(() => { vi.advanceTimersByTime(TOUR_TURN_DELAY_MS * 12); });
    expect(r.container.innerHTML).not.toBe(before);
  });

  it("styles a centred callout over a stronger blur, still on the act surface only, with no animation under reduced motion", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const blurRule = css.match(/([^{}]+)\{ filter: blur\(4px\) saturate\(0\.75\); \}/);
    expect(blurRule?.[1]?.trim()).toBe('.tour-stage[data-beat="teach"] .tour-act,\n.tour-stage[data-beat="teach"] .tour-stage-actions');
    expect(css).toContain("background: color-mix(in srgb, var(--nb-paper) 58%, transparent)");
    expect(css).toMatch(/\.tour-teaching-callout\.is-teaching \{ top: 50%; right: auto; left: 50%;[^}]*transform: translate\(-50%, -50%\);/);
    expect(css).not.toMatch(/\.tour-(instruction-band|step-marker|stage-header|rail)[^{]*\{[^}]*filter: blur/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.tour-act, \.tour-stage-actions \{ transition: none !important; \}\s*\.tour-teach-scrim, \.tour-teaching-callout\.is-teaching \{ animation: none !important; \}/);
    expect(css).not.toContain("TVk: teach beat");
  });
});
