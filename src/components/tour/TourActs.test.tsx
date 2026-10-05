// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TourActFive, TourActFour, TourActOne, TourActThree, TourActTwo } from "@/components/tour/TourActs";
import { TOUR_BOARD_LAYOUT, TOUR_CONTEXT_SENTENCE } from "@/lib/tour-content";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function mockRects(board: HTMLElement, cardRect: (element: HTMLElement) => DOMRect) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this === board) return rect(0, 0, 1000, 1000);
    if (this.hasAttribute("data-tour-card")) return cardRect(this);
    return rect(0, 0, 0, 0);
  });
}

describe("tour acts one to three", () => {
  it("keeps the shared layout free of accidental rows and columns", () => {
    const counts = (values: readonly number[]) => values.reduce((result, value) => result.set(value, (result.get(value) ?? 0) + 1), new Map<number, number>());
    expect(Math.max(...counts(TOUR_BOARD_LAYOUT.map((item) => item.x)).values())).toBeLessThanOrEqual(2);
    expect(Math.max(...counts(TOUR_BOARD_LAYOUT.map((item) => item.y)).values())).toBeLessThanOrEqual(2);
    expect(new Set(TOUR_BOARD_LAYOUT.map((item) => item.widthBasis)).size).toBeGreaterThanOrEqual(4);
    for (const item of TOUR_BOARD_LAYOUT) expect(Math.abs(item.rotation)).toBeLessThan(1.5);
    for (let index = 0; index < TOUR_BOARD_LAYOUT.length; index += 1) {
      const item = TOUR_BOARD_LAYOUT[index];
      if (!item) continue;
      for (const other of TOUR_BOARD_LAYOUT.slice(index + 1)) {
        if (Math.abs(item.x - other.x) <= 1) expect(Math.abs(item.y - other.y)).toBeGreaterThan(18);
        if (Math.abs(item.y - other.y) <= 1) expect(Math.abs(item.x - other.x)).toBeGreaterThan(18);
      }
    }
  });
  it("keeps every shared layout item fixed across all five acts and four registers", () => {
    const registers = ["company", "partner", "personal", "edu"] as const;
    const acts = [
      (register: (typeof registers)[number]) => <TourActOne register={register} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActTwo register={register} hint={false} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActThree register={register} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActFour register={register} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActFive register={register} onLanded={vi.fn()} />,
    ];
    for (const register of registers) {
      const seen = new Map<string, string>();
      acts.forEach((renderAct) => {
        const rendered = render(renderAct(register));
        for (const item of TOUR_BOARD_LAYOUT) {
          const element = rendered.container.querySelector<HTMLElement>(`[data-tour-layout-id="${item.id}"]`);
          if (!element) continue;
          const geometry = [element.style.left, element.style.top, element.style.width, element.style.transform].join("|");
          expect(geometry).toBe(`${item.x}%|${item.y}%|${item.widthBasis}%|rotate(${item.rotation}deg)`);
          if (seen.has(item.id)) expect(geometry).toBe(seen.get(item.id));
          else seen.set(item.id, geometry);
        }
        rendered.unmount();
      });
    }
  });
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
      expect(rendered.container.querySelector(`[data-tour-target="${index + 3}"]`)).toBeTruthy();
      rendered.unmount();
    });
  });

  it("advances act one on a pointer drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    expect(screen.queryByLabelText("Your files")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
    const file = screen.getByRole("button", { name: "Fall launch plan.pdf" });
    const board = screen.getByTestId("tour-drop-board");
    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({ left: 200, right: 600, top: 0, bottom: 400, width: 400, height: 400, x: 200, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(file, { pointerId: 1, pointerType: "mouse", clientX: 20, clientY: 20 });
    fireEvent.pointerUp(screen.getByTestId("tour-act-one"), { pointerId: 1, pointerType: "mouse", clientX: 300, clientY: 200 });
    expect(done).toHaveBeenCalledWith("Fall launch plan.pdf");
  });

  it("advances act one on touch", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
    const file = screen.getByRole("button", { name: "Fall launch plan.pdf" });
    fireEvent.pointerDown(file, { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    fireEvent.pointerUp(screen.getByTestId("tour-act-one"), { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    expect(done).toHaveBeenCalledWith("Fall launch plan.pdf");
  });

  it("advances act one after keyboard lift, move and drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
    const file = screen.getByRole("button", { name: "Fall launch plan.pdf" });
    fireEvent.keyDown(file, { code: "Space", key: " " });
    fireEvent.keyDown(file, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyDown(file, { code: "Space", key: " " });
    expect(done).toHaveBeenCalledWith("Fall launch plan.pdf");
  });

  it("advances act two exactly once when one outlined work card is clicked", () => {
    const done = vi.fn();
    render(<TourActTwo register="company" hint={false} onComplete={done} />);
    const cards = screen.getAllByRole("group");
    fireEvent.click(cards[0]!);
    expect(done).toHaveBeenCalledTimes(1);
    fireEvent.click(cards[1]!);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("advances act two exactly once when Space selects one outlined work card", () => {
    const done = vi.fn();
    render(<TourActTwo register="company" hint={false} onComplete={done} />);
    const cards = screen.getAllByRole("group");
    fireEvent.keyDown(cards[0]!, { code: "Space", key: " " });
    expect(done).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(cards[2]!, { code: "Space", key: " " });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("keeps the loose AI chat work cards inert while one outlined work card advances", () => {
    const done = vi.fn();
    render(<TourActTwo register="company" hint={false} onComplete={done} />);
    const ambient = screen.getByLabelText("Loose AI chat work cards");
    expect(ambient.querySelectorAll('[tabindex="0"]')).toHaveLength(0);
    const cards = screen.getAllByRole("group").filter((card) => card.getAttribute("tabindex") === "0");
    fireEvent.click(cards[0]!);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("shows five distinct AI chats in free form regions without clipping titles", () => {
    render(<TourActTwo register="company" hint={false} onComplete={vi.fn()} />);
    const chats = Array.from(document.querySelectorAll<HTMLElement>(".tour-preview-card")).filter((card) => /ChatGPT:|Claude:|Gemini:/.test(card.textContent ?? ""));
    expect(chats).toHaveLength(6);
    expect(chats.filter((card) => card.textContent?.includes("ChatGPT:"))).toHaveLength(3);
    expect(chats.filter((card) => card.textContent?.includes("Claude:"))).toHaveLength(2);
    expect(chats.filter((card) => card.textContent?.includes("Gemini:"))).toHaveLength(1);
    expect(screen.getByText("Claude: positioning lines")).toBeTruthy();
    expect(screen.getByLabelText("Loose AI chat work cards").classList.contains("tour-region")).toBe(false);
  });

  it("renders the exported context sentence after grouping", () => {
    render(<TourActThree register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add grouping" }));
    expect(screen.getByText(TOUR_CONTEXT_SENTENCE)).toBeTruthy();
  });

  it("advances act two exactly once when a marquee is dragged around the three outlined work cards", () => {
    const done = vi.fn();
    render(<TourActTwo register="company" hint={false} onComplete={done} />);
    const board = screen.getByTestId("tour-act-two");
    mockRects(board, (element) => {
      const id = element.dataset["tourCard"] ?? "";
      const index = Number(id.replace("tour-card-", ""));
      if (id.startsWith("tour-card-") && index < 3) return rect(50 + index * 110, 50, 90, 90);
      return rect(800, 700, 90, 90);
    });
    fireEvent.pointerDown(board, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 420, clientY: 200 });
    fireEvent.pointerUp(board, { pointerId: 1, clientX: 420, clientY: 200 });
    expect(done).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(board, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 420, clientY: 200 });
    fireEvent.pointerUp(board, { pointerId: 1, clientX: 420, clientY: 200 });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("groups act three when a marquee encloses the three work cards, ignoring loose AI chats", () => {
    const done = vi.fn();
    render(<TourActThree register="company" onComplete={done} />);
    const board = screen.getByTestId("tour-act-three").querySelector<HTMLElement>(".tour-board-act")!;
    mockRects(board, (element) => element.hasAttribute("data-tour-ambient") ? rect(800, 700, 90, 90) : rect(120, 60, 90, 90));
    fireEvent.pointerDown(board, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 500, clientY: 300 });
    fireEvent.pointerUp(board, { pointerId: 1, clientX: 500, clientY: 300 });
    expect(done).toHaveBeenCalledTimes(1);
    expect(screen.getByText(TOUR_CONTEXT_SENTENCE)).toBeTruthy();
  });


  it("keeps the preset question read only", () => {
    render(<TourActFour register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    const question = screen.getByLabelText("Preset question");
    expect(question.getAttribute("contenteditable")).not.toBe("true");
    expect(question.getAttribute("aria-readonly")).toBe("true");
    expect(question.textContent).toBe("What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.");
  });

  it("shows exactly three cited claims from work cards in the frame", () => {
    vi.useFakeTimers();
    render(<TourActFour register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    act(() => vi.advanceTimersByTime(1200));
    const claims = document.querySelectorAll(".tour-ask-claim");
    expect(claims).toHaveLength(3);
    const frameText = screen.getByLabelText("Workstream with three source work cards").textContent ?? "";
    for (const claim of claims) expect(frameText).toContain(claim.querySelector("span")?.textContent);
    expect(screen.getByRole("button", { name: "Open the chat: Claude: channel mix options" })).toBeTruthy();
    vi.useRealTimers();
  });

  it("keeps an answer on the board and ends the tour", () => {
    const landed = vi.fn();
    render(<TourActFive register="company" onLanded={landed} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByTestId("tour-deliverable")).toBeTruthy();
    expect(screen.getByText("Client launch note")).toBeTruthy();
    expect(screen.getByText("Every line in here can show where it came from.")).toBeTruthy();
    expect(document.querySelectorAll('.tour-keep-links [role="button"]')).toHaveLength(3);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Launch deck, slide 12")).toBeTruthy();
    expect(screen.getByLabelText("Moodboard photo")).toBeTruthy();
  });

  it("anchors each kept-answer connector to a source work card", () => {
    render(<TourActFive register="company" onLanded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    const sources = document.querySelectorAll("[data-tour-connector-source]");
    const connectors = Array.from(document.querySelectorAll<SVGElement>('.tour-keep-links [role="button"]'));
    expect(sources).toHaveLength(3);
    expect(connectors).toHaveLength(3);
    connectors.forEach((connector, index) => {
      const sourceTitle = sources[index]?.querySelector("strong")?.textContent;
      expect(sourceTitle).toBeTruthy();
      expect(connector.getAttribute("aria-label")).toContain(sourceTitle);
    });
  });

  it("keeps the answer by keyboard and shows all three cited lines", () => {
    const landed = vi.fn();
    render(<TourActFive register="company" onLanded={landed} />);
    const keep = screen.getByRole("button", { name: "Keep" });
    keep.focus();
    fireEvent.keyDown(keep, { key: "Enter", code: "Enter" });
    fireEvent.click(keep);
    expect(document.activeElement).toBe(keep);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".tour-deliverable-line")).toHaveLength(3);
    expect(screen.getByText("You floated a TikTok first launch and dropped it.")).toBeTruthy();
    expect(screen.getByText("Toronto made the creator brief and never reached the plan.")).toBeTruthy();
    expect(screen.getByText("The plan kept Austin and Denver only.")).toBeTruthy();
  });

  it("uses the standalone mimic shape without importing the live data surface", () => {
    render(<TourActFour register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    expect(screen.getByLabelText("Ask Lasso tour example")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
  });
});