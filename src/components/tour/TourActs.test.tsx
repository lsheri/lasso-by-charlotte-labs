// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TourActOne, TourActThree, TourActTwo } from "@/components/tour/TourActs";
import { TOUR_CONTEXT_SENTENCE } from "@/lib/tour-content";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

afterEach(cleanup);

describe("tour acts one to three", () => {
  it("advances act one on a pointer drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    const file = screen.getByRole("button", { name: "Q3 strategy deck.pdf" });
    const board = screen.getByTestId("tour-drop-board");
    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({ left: 200, right: 600, top: 0, bottom: 400, width: 400, height: 400, x: 200, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(file, { pointerId: 1, pointerType: "mouse", clientX: 20, clientY: 20 });
    fireEvent.pointerUp(screen.getByTestId("tour-act-one"), { pointerId: 1, pointerType: "mouse", clientX: 300, clientY: 200 });
    expect(done).toHaveBeenCalledWith("Q3 strategy deck.pdf");
  });

  it("advances act one on touch", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    const file = screen.getByRole("button", { name: "Q3 strategy deck.pdf" });
    fireEvent.pointerDown(file, { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    fireEvent.pointerUp(screen.getByTestId("tour-act-one"), { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    expect(done).toHaveBeenCalledWith("Q3 strategy deck.pdf");
  });

  it("advances act one after keyboard lift, move and drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    const file = screen.getByRole("button", { name: "Q3 strategy deck.pdf" });
    fireEvent.keyDown(file, { code: "Space", key: " " });
    fireEvent.keyDown(file, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyDown(file, { code: "Space", key: " " });
    expect(done).toHaveBeenCalledWith("Q3 strategy deck.pdf");
  });

  it("advances act two only after all three set cards are selected", () => {
    const done = vi.fn();
    render(<TourActTwo register="company" hint={false} onComplete={done} />);
    const cards = screen.getAllByRole("group");
    fireEvent.keyDown(cards[0]!, { code: "Space", key: " " });
    fireEvent.keyDown(cards[1]!, { code: "Space", key: " " });
    expect(done).not.toHaveBeenCalled();
    fireEvent.keyDown(cards[3]!, { code: "Space", key: " " });
    expect(done).not.toHaveBeenCalled();
    fireEvent.keyDown(cards[2]!, { code: "Space", key: " " });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("renders the exported context sentence after grouping", () => {
    render(<TourActThree register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Group" }));
    expect(screen.getByText(TOUR_CONTEXT_SENTENCE)).toBeTruthy();
  });
});