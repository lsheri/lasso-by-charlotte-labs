// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourActFive, TourActSix, useTourActRenderers } from "@/components/tour/TourActs";
import { TOUR_ACT_EIGHT_BOARD_IDS } from "@/components/tour/TourBoard";
import { TourStage } from "@/components/tour/TourStage";
import { ARROW_EDGE_GAP, arrowEnd } from "@/components/tour/TourStage";
import { TOUR_BOARD_LAYOUT, TOUR_CONTENT, actById } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;
const TVF_LAYOUT = [
  ["primary-0", "primary", 3, 19, 21, -0.8, 3],
  ["primary-1", "primary", 31, 17.5, 22, 0.7, 3],
  ["primary-2", "primary", 60, 20.5, 21, 0.5, 3],
  ["primary-3", "primary", 5, 44, 18, 0.9, 3],
  ["answer", "answer", 33, 82, 23, 0, 7],
  ["chat-0", "chat", 32, 42, 21, -0.7, 3],
  ["chat-1", "chat", 62, 44.5, 22, 0.8, 3],
  ["artifact", "artifact", 84.5, 66, 13, 0.4, 3],
  ["whiteboard", "image", 5, 78.5, 18, -0.4, 3],
  ["deck", "image", 72, 84, 20, 0.3, 3],
  ["deliverable", "deliverable", 31.5, 80, 25, -0.3, 7],
] as const;

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
global.ResizeObserver = ResizeObserverStub;

let reducedMotion = false;
beforeEach(() => {
  reducedMotion = false;
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("TVc note and deck source trail", () => {
  it("pins every remaining board item by value and removes only the three crowded cards", () => {
    expect(TOUR_BOARD_LAYOUT.map((item) => [item.id, item.kind, item.x, item.y, item.widthBasis, item.rotation, item.earliestAct])).toEqual(TVF_LAYOUT);
    expect(TOUR_BOARD_LAYOUT.some((item) => ["primary-4", "chat-2", "chat-3"].includes(item.id))).toBe(false);
  });

  it("pins the act seven note teaching and act eight deck copy", () => {
    for (const register of REGISTERS) {
      const act = actById(register, 7);
      expect(act?.captionPointer).toBe("Click Keep.");
      expect(act?.captionTouch).toBe("Tap Keep.");
      expect(act?.why).toBe("Keep anything Lasso gives you as a note on the board. Months later it still shows the work behind it.");
      expect(act?.deliverable).toBeUndefined();
      expect(act?.closingLine).toBeUndefined();
      expect(act?.primaryActionLabel).toBe("See it in the deck");
      const deckAct = actById(register, 8);
      expect(deckAct?.captionPointer).toBe("See how the deck connects back.");
      expect(deckAct?.captionTouch).toBe("See how the deck connects back.");
      expect(deckAct?.why).toBe("The deck is what the client sees. Every line in it can still point at the chat or file it came from.");
      expect(deckAct?.deliverable).toEqual({ caption: "Three pieces of work. One slide. The work traced back to your AI conversations." });
      expect(deckAct?.closingLine).toBe("That is the whole thing. Everything else is more of it.");
      expect(deckAct?.primaryActionLabel).toBe("Start with my own work");
      expect(actById(register, 6)?.answer).toEqual([
        { text: "You floated a TikTok first launch and dropped it.", sourceCardTitle: "Claude: channel mix options" },
        { text: "Toronto made the creator brief and never reached the plan.", sourceCardTitle: "ChatGPT: creator brief, draft 2" },
        { text: "The plan kept Austin and Denver only.", sourceCardTitle: "Fall launch plan v3" },
      ]);
      expect(TOUR_CONTENT[register].acts).toHaveLength(8);
    }
  });

  it("shows the complete slide at once with reduced motion", () => {
    reducedMotion = true;
    render(<TourActSix register="company" />);
    const slide = screen.getByTestId("tour-deck-slide");
    expect(slide.hasAttribute("data-reduced")).toBe(true);
    expect(slide.querySelectorAll(".tour-deck-page li")).toHaveLength(3);
    expect(document.querySelectorAll('.tour-keep-links [role="button"]')).toHaveLength(3);
  });

  it("advances from the kept note to the deck by pointer and keyboard", () => {
    function Harness() {
      const [activeAct, setActiveAct] = useState<7 | 8>(7);
      const { renderers, instructionOverride, hint } = useTourActRenderers({
        register: "company",
        activeAct,
        onAdvance: () => setActiveAct(8),
        onHintShown: () => undefined,
        onFinish: () => undefined,
      });
      return <TourStage register="company" activeAct={activeAct} acts={renderers} onSkip={() => undefined} onBack={() => undefined} onHintShown={hint} instructionOverride={instructionOverride} />;
    }
    const pointer = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.queryByRole("button", { name: "Start with my own work" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See it in the deck" }));
    expect(screen.getByTestId("tour-deck-slide")).toBeTruthy();
    pointer.unmount();

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    const next = screen.getByRole("button", { name: "See it in the deck" });
    next.focus();
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, { key: "Enter" });
    fireEvent.click(next);
    expect(screen.getByTestId("tour-deck-slide")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start with my own work" })).toBeTruthy();
  });

  it("keeps every visible act eight item at its act seven geometry and hides the exact remainder", () => {
    const note = render(<TourActFive register="company" onLanded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    const actSevenIds = TOUR_BOARD_LAYOUT.filter((item) => item.id !== "deliverable").map((item) => item.id);
    expect(actSevenIds).toEqual(["primary-0", "primary-1", "primary-2", "primary-3", "answer", "chat-0", "chat-1", "artifact", "whiteboard", "deck"]);
    const noteGeometry = new Map(TOUR_BOARD_LAYOUT.filter((item) => TOUR_ACT_EIGHT_BOARD_IDS.includes(item.id as (typeof TOUR_ACT_EIGHT_BOARD_IDS)[number])).map((item) => {
      const element = note.container.querySelector<HTMLElement>(`[data-tour-layout-id="${item.id}"]`);
      return [item.id, element ? [element.style.left, element.style.top, element.style.width, element.style.transform].join("|") : null];
    }));
    note.unmount();
    const deck = render(<TourActSix register="company" />);
    const renderedIds = Array.from(deck.container.querySelectorAll<HTMLElement>("[data-tour-layout-id]"), (element) => element.dataset["tourLayoutId"]);
    expect(renderedIds).toEqual([...TOUR_ACT_EIGHT_BOARD_IDS, "deliverable"]);
    const hiddenIds = TOUR_BOARD_LAYOUT.map((item) => item.id).filter((id) => !renderedIds.includes(id));
    expect(hiddenIds).toEqual(["primary-3", "chat-0", "chat-1", "artifact", "whiteboard", "deck"]);
    for (const item of TOUR_BOARD_LAYOUT.filter((candidate) => TOUR_ACT_EIGHT_BOARD_IDS.includes(candidate.id as (typeof TOUR_ACT_EIGHT_BOARD_IDS)[number]))) {
      const element = deck.container.querySelector<HTMLElement>(`[data-tour-layout-id="${item.id}"]`);
      expect(element ? [element.style.left, element.style.top, element.style.width, element.style.transform].join("|") : null).toBe(noteGeometry.get(item.id));
    }
    expect(deck.container.querySelectorAll("[data-tour-note], .tour-shared-group-region, .tour-loose-work-label")).toHaveLength(0);
  });

  it("renders only three sources, the answer, the sourced slide, and three connectors in act eight", () => {
    render(<TourActSix register="company" />);
    expect(Array.from(document.querySelectorAll("[data-tour-connector-source]"), (source) => source.getAttribute("data-tour-layout-id"))).toEqual(["primary-0", "primary-1", "primary-2"]);
    expect(document.querySelector('[data-tour-layout-id="answer"]')).toBeTruthy();
    const slide = screen.getByTestId("tour-deck-slide");
    expect(slide.getAttribute("data-tour-title")).toBe("Launch deck, slide 12");
    expect(slide.querySelectorAll(".tour-deck-page li")).toHaveLength(3);
    expect(slide.querySelectorAll(".tour-deck-page li .h-7.w-7")).toHaveLength(3);
    expect(document.querySelectorAll('.tour-keep-links [role="button"]')).toHaveLength(3);
  });

  it("keeps act one and two arrows outside their controls while later arrows retain centre aim", () => {
    const base = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
    const from = { left: 20, top: 20, right: 220, bottom: 80, width: 200, height: 60 };
    const target = { left: 500, top: 300, right: 620, bottom: 340, width: 120, height: 40 };
    expect(arrowEnd(1, from, target, base)).toEqual({ x: target.left - ARROW_EDGE_GAP, y: 320 });
    expect(arrowEnd(2, from, target, base)).toEqual({ x: target.left - ARROW_EDGE_GAP, y: 320 });
    expect(arrowEnd(3, from, target, base)).toEqual({ x: 560, y: 320 });
  });
});