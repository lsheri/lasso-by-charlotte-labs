// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TourActFive, TourActFour, TourActOne, TourActThree, TourActTwo } from "@/components/tour/TourActs";
import { TOUR_CONTEXT_SENTENCE } from "@/lib/tour-content";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

afterEach(cleanup);

describe("tour acts one to three", () => {
  it("gives every act an anchored instruction target", () => {
    const views = [
      <TourActOne key="one" register="company" onComplete={vi.fn()} />,
      <TourActTwo key="two" register="company" hint={false} onComplete={vi.fn()} />,
      <TourActThree key="three" register="company" onComplete={vi.fn()} />,
      <TourActFour key="four" register="company" onComplete={vi.fn()} />,
      <TourActFive key="five" register="company" onLanded={vi.fn()} />,
    ];
    views.forEach((view, index) => {
      const rendered = render(view);
      expect(rendered.container.querySelector(`[data-tour-target="${index + 1}"]`)).toBeTruthy();
      rendered.unmount();
    });
  });

  it("advances act one on a pointer drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    expect(screen.queryByLabelText("Your files")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
    const file = screen.getByRole("button", { name: "Q3 strategy deck.pdf" });
    fireEvent.pointerDown(file, { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    fireEvent.pointerUp(screen.getByTestId("tour-act-one"), { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    expect(done).toHaveBeenCalledWith("Q3 strategy deck.pdf");
  });

  it("advances act one after keyboard lift, move and drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
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

  it("advances act two when all three set cards and one extra are selected", () => {
    const done = vi.fn();
    render(<TourActTwo register="company" hint={false} onComplete={done} />);
    const cards = screen.getAllByRole("group");
    fireEvent.keyDown(cards[3]!, { code: "Space", key: " " });
    fireEvent.keyDown(cards[0]!, { code: "Space", key: " " });
    fireEvent.keyDown(cards[1]!, { code: "Space", key: " " });
    fireEvent.keyDown(cards[2]!, { code: "Space", key: " " });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("renders the exported context sentence after grouping", () => {
    render(<TourActThree register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add grouping" }));
    expect(screen.getByText(TOUR_CONTEXT_SENTENCE)).toBeTruthy();
  });

  it("keeps the preset question read only", () => {
    render(<TourActFour register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    const question = screen.getByLabelText("Preset question");
    expect(question.getAttribute("contenteditable")).not.toBe("true");
    expect(question.getAttribute("aria-readonly")).toBe("true");
    expect(question.textContent).toBe("What ideas did I have that did not make the final deck? Give me the link to the AI chat I worked them out in.");
  });

  it("shows exactly three cited claims from cards in the frame", () => {
    vi.useFakeTimers();
    render(<TourActFour register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    act(() => vi.advanceTimersByTime(1200));
    const claims = document.querySelectorAll(".tour-ask-claim");
    expect(claims).toHaveLength(3);
    const frameText = screen.getByLabelText("Workstream with three source cards").textContent ?? "";
    for (const claim of claims) expect(frameText).toContain(claim.querySelector("span")?.textContent);
    expect(screen.getByRole("button", { name: "Open the chat: Claude: pricing options" })).toBeTruthy();
    vi.useRealTimers();
  });

  it("keeps an answer on the board and ends the tour", () => {
    const landed = vi.fn();
    render(<TourActFive register="company" onLanded={landed} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByTestId("canvas-lab-answer-card")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Select relationship/ })).toHaveLength(3);
    expect(landed).toHaveBeenCalledTimes(1);
  });

  it("anchors each kept-answer connector to a source card", () => {
    render(<TourActFive register="company" onLanded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    const sources = document.querySelectorAll("[data-tour-connector-source]");
    const connectors = screen.getAllByRole("button", { name: /Select relationship/ });
    expect(sources).toHaveLength(3);
    expect(connectors).toHaveLength(3);
    connectors.forEach((connector, index) => expect(connector.getAttribute("aria-label")).toContain(sources[index]?.textContent));
  });

  it("uses the standalone mimic shape without importing the live data surface", () => {
    render(<TourActFour register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    expect(screen.getByLabelText("Ask Lasso tour example")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
  });
});