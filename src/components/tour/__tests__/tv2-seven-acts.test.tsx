// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourActArrived, TourActPush, useTourActRenderers } from "@/components/tour/TourActs";
import { TourStage } from "@/components/tour/TourStage";
import { TOUR_CONTENT, TOUR_PUSHED_CHAT, actById, tourAmbientCards, type TourActId } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;

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
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function Harness({ start = 1 as TourActId }: { start?: TourActId }) {
  const [activeAct, setActiveAct] = useState<TourActId>(start);
  const { renderers, instructionOverride, hint } = useTourActRenderers({
    register: "company", activeAct, onAdvance: (from) => setActiveAct((from + 1) as TourActId), onHintShown: () => undefined, onFinish: () => undefined,
  });
  return <TourStage register="company" activeAct={activeAct} acts={renderers} onSkip={() => undefined} onBack={() => undefined} onHintShown={hint} instructionOverride={instructionOverride} />;
}

describe("TV2 seven act tour", () => {
  it("has seven acts with ids one to seven and no gaps in every register", () => {
    for (const register of REGISTERS) {
      expect(TOUR_CONTENT[register].acts.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it("keeps the old acts in order at their new ids", () => {
    for (const register of REGISTERS) {
      expect(actById(register, 3)?.captionPointer).toBe("Drag a file onto the board.");
      expect(actById(register, 3)?.files).toEqual(["Fall launch plan.pdf", "Creator call.txt", "Media budget.xlsx", "moodboard.png"]);
      expect(actById(register, 7)?.captionPointer).toBe("Keep it. Now the answer lives next to what it came from.");
      expect(actById(register, 7)?.primaryActionLabel).toBe("Start with my own work");
      expect(actById(register, 1)?.captionPointer).toBe("Push the chat into Lasso.");
      expect(actById(register, 2)?.captionPointer).toBe("It is already here. You did not have to file it.");
    }
  });

  it("plays the turns one at a time before the Push control appears and takes focus", () => {
    vi.useFakeTimers();
    render(<TourActPush register="company" onComplete={vi.fn()} />);
    expect(document.querySelectorAll(".tour-chat-turn")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Push to Lasso" })).toBeNull();
    act(() => vi.advanceTimersByTime(260));
    expect(document.querySelectorAll(".tour-chat-turn")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(260 * 4));
    expect(screen.getByText("Push this to Lasso.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Push to Lasso" })).toBeNull();
    act(() => vi.advanceTimersByTime(260));
    const push = screen.getByRole("button", { name: "Push to Lasso" });
    expect(document.activeElement).toBe(push);
  });

  it("shows every turn and the Push control at once with reduced motion", () => {
    reducedMotion = true;
    vi.useFakeTimers();
    render(<TourActPush register="company" onComplete={vi.fn()} />);
    expect(document.querySelectorAll(".tour-chat-turn")).toHaveLength(TOUR_PUSHED_CHAT.turns.length + 1);
    expect(screen.getByRole("button", { name: "Push to Lasso" })).toBeTruthy();
  });

  it("advances from act one to act two when Push is pressed, and confirms once", () => {
    reducedMotion = true;
    render(<Harness />);
    const push = screen.getByRole("button", { name: "Push to Lasso" });
    fireEvent.click(push);
    expect(screen.getByLabelText("All AI Conversations tour example")).toBeTruthy();
    expect(screen.getByText("It is already here. You did not have to file it.")).toBeTruthy();
  });

  it("shows the pushed chat at the top of the list and advances to the file act when clicked", () => {
    render(<Harness start={2} />);
    const rows = within(screen.getByRole("list", { name: "AI conversations" })).getAllByRole("listitem");
    expect(rows).toHaveLength(1 + tourAmbientCards("company").length);
    expect(rows[0]?.textContent).toContain(TOUR_PUSHED_CHAT.title);
    expect(rows[0]?.textContent).toContain("Just arrived");
    expect(rows.slice(1).map((row) => row.querySelector("strong")?.textContent)).toEqual(tourAmbientCards("company").map((card) => card.title));
    fireEvent.click(within(rows[0]!).getByRole("button"));
    expect(screen.getByTestId("tour-act-one")).toBeTruthy();
    expect(screen.getByText("Drag a file onto the board.")).toBeTruthy();
  });

  it("completes acts one and two by keyboard alone", async () => {
    reducedMotion = true;
    const pushed = vi.fn();
    const arrived = vi.fn();
    const { unmount } = render(<TourActPush register="company" onComplete={pushed} />);
    const push = screen.getByRole("button", { name: "Push to Lasso" });
    expect(push.tagName).toBe("BUTTON");
    expect(push.getAttribute("tabindex")).not.toBe("-1");
    push.focus();
    fireEvent.keyDown(push, { key: "Enter" });
    fireEvent.click(push);
    expect(pushed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Pushed to Lasso" })).toBeTruthy();
    unmount();
    render(<TourActArrived register="company" onComplete={arrived} />);
    const row = screen.getByRole("button", { name: /Claude: channel mix options/ });
    expect(row.tagName).toBe("BUTTON");
    row.focus();
    expect(document.activeElement).toBe(row);
    fireEvent.click(row);
    fireEvent.click(row);
    expect(arrived).toHaveBeenCalledTimes(1);
  });

  it("draws seven rail marks", () => {
    reducedMotion = true;
    const { container } = render(<Harness />);
    expect(container.querySelectorAll(".tour-rail-segment")).toHaveLength(7);
    expect(screen.getByText("Step 1 of 7")).toBeTruthy();
  });
});
