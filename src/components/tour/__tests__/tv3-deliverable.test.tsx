// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourActFive } from "@/components/tour/TourActs";
import { ARROW_EDGE_GAP, arrowEnd } from "@/components/tour/TourStage";
import { TOUR_BOARD_LAYOUT, TOUR_CONTENT, actById } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;
const PRE_TV3_LAYOUT = [
  ["primary-0", "primary", 3, 19, 21, -0.8, 3],
  ["primary-1", "primary", 31, 17.5, 22, 0.7, 3],
  ["primary-2", "primary", 60, 20.5, 21, 0.5, 3],
  ["primary-3", "primary", 5, 44, 18, 0.9, 3],
  ["primary-4", "primary", 6.5, 59, 19, -0.7, 3],
  ["answer", "answer", 33, 82, 23, 0, 7],
  ["chat-0", "chat", 32, 42, 21, -0.7, 3],
  ["chat-1", "chat", 62, 44.5, 22, 0.8, 3],
  ["chat-2", "chat", 30, 63.5, 22, 0.5, 3],
  ["chat-3", "chat", 61, 65.5, 21, -0.6, 3],
  ["artifact", "artifact", 84.5, 66, 13, 0.4, 3],
  ["whiteboard", "image", 5, 78.5, 18, -0.4, 3],
  ["deck", "image", 72, 84, 20, 0.3, 7],
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

describe("TV3 deliverable and source trail", () => {
  it("adds only the deliverable without moving any pre-existing board item", () => {
    expect(TOUR_BOARD_LAYOUT.filter((item) => item.id !== "deliverable").map((item) => [item.id, item.kind, item.x, item.y, item.widthBasis, item.rotation, item.earliestAct])).toEqual(PRE_TV3_LAYOUT);
    expect(TOUR_BOARD_LAYOUT.find((item) => item.id === "deliverable")).toEqual({ id: "deliverable", kind: "deliverable", x: 31.5, y: 80, widthBasis: 25, rotation: -0.3, earliestAct: 7 });
  });

  it("pins the act seven deliverable copy and its three source claims", () => {
    for (const register of REGISTERS) {
      const act = actById(register, 7);
      expect(act?.captionPointer).toBe("Keep it. Now the answer lives next to what it came from.");
      expect(act?.deliverable).toEqual({ title: "Client launch note", note: "Every line in here can show where it came from." });
      expect(act?.closingLine).toBe("That is the whole thing. Everything else is more of it.");
      expect(actById(register, 6)?.answer).toEqual([
        { text: "You floated a TikTok first launch and dropped it.", sourceCardTitle: "Claude: channel mix options" },
        { text: "Toronto made the creator brief and never reached the plan.", sourceCardTitle: "ChatGPT: creator brief, draft 2" },
        { text: "The plan kept Austin and Denver only.", sourceCardTitle: "Fall launch plan v3" },
      ]);
      expect(TOUR_CONTENT[register].acts).toHaveLength(7);
    }
  });

  it("shows the complete deliverable at once with reduced motion", () => {
    reducedMotion = true;
    render(<TourActFive register="company" onLanded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    const deliverable = screen.getByTestId("tour-deliverable");
    expect(deliverable.hasAttribute("data-reduced")).toBe(true);
    expect(deliverable.querySelectorAll(".tour-deliverable-line")).toHaveLength(3);
    expect(screen.getByText("Every line in here can show where it came from.")).toBeTruthy();
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