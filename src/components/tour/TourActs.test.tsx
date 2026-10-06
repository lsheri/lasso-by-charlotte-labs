// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourActFive, TourActFour, TourActOne, TourActSix, TourActThree, TourActTwo, useTourActRenderers } from "@/components/tour/TourActs";
import { TourStage } from "@/components/tour/TourStage";
import { ASK_SCOPE_ALL_LABEL, ASK_SCOPE_ONE_LABEL, askScopeWorkstreamLabel } from "@/components/reflect/AskSurface";
import { TOUR_BOARD_LAYOUT, TOUR_CONTEXT_SENTENCE, TOUR_PUSHED_CHAT, actById, tourBoardCopy } from "@/lib/tour-content";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

beforeEach(() => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion"), media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

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
  it("keeps every shared layout item fixed across all six board acts and four registers", () => {
    const registers = ["company", "partner", "personal", "edu"] as const;
    const acts = [
      (register: (typeof registers)[number]) => <TourActOne register={register} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActTwo register={register} hint={false} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActThree register={register} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActFour register={register} onComplete={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActFive register={register} onLanded={vi.fn()} />,
      (register: (typeof registers)[number]) => <TourActSix register={register} />,
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
  it("keeps every live target actionable and removes each completed target immediately", async () => {
    function Harness({ activeAct }: { activeAct: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 }) {
      const { renderers, instructionOverride, hint } = useTourActRenderers({ register: "company", activeAct, onAdvance: vi.fn(), onHintShown: vi.fn(), onFinish: vi.fn() });
      return <TourStage register="company" activeAct={activeAct} acts={renderers} onSkip={vi.fn()} onBack={vi.fn()} onHintShown={hint} instructionOverride={instructionOverride} />;
    }
    for (const activeAct of [2, 3, 4, 5, 6, 7, 8] as const) {
      const rendered = render(<Harness activeAct={activeAct} />);
      await waitFor(() => expect(rendered.container.querySelectorAll(`[data-tour-target="${activeAct}"]`)).toHaveLength(1));
      rendered.unmount();
    }
    const actOne = render(<Harness activeAct={1} />);
    const targets = actOne.container.querySelectorAll<HTMLElement>('[data-tour-target="1"]');
    expect(targets).toHaveLength(2);
    expect(Array.from(targets).every((target) => target.tagName === "BUTTON" && target.textContent === "Push to Lasso")).toBe(true);
    fireEvent.click(targets[0]!);
    expect(actOne.container.querySelectorAll('[data-tour-target="1"]')).toHaveLength(1);
    fireEvent.click(actOne.container.querySelector('[data-tour-target="1"]') as HTMLElement);
    expect(screen.getByRole("button", { name: "Next" }).getAttribute("data-tour-target")).toBe("1");
    expect(actOne.container.querySelectorAll('[data-tour-target="1"]')).toHaveLength(1);
  });

  it("advances act one on a pointer drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    expect(screen.queryByLabelText("AI conversation to bring in")).toBeNull();
    const beforeIds = Array.from(document.querySelectorAll<HTMLElement>("[data-tour-card]"), (card) => card.dataset["tourCard"]);
    expect(beforeIds).toEqual(["tour-card-0", "tour-card-1", "tour-card-3", "ambient-0", "ambient-1"]);
    expect(screen.getByText("Fall launch plan v3")).toBeTruthy();
    expect(screen.queryByText(TOUR_PUSHED_CHAT.title)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
    expect(screen.getByRole("button", { name: "Add work" }).hasAttribute("data-tour-target")).toBe(false);
    const picker = screen.getByLabelText("AI conversation to bring in");
    const choices = Array.from(picker.querySelectorAll("button"));
    expect(choices).toHaveLength(1);
    expect(choices[0]?.textContent).toContain(TOUR_PUSHED_CHAT.title);
    const file = screen.getByRole("button", { name: TOUR_PUSHED_CHAT.title });
    expect(file.getAttribute("data-tour-target")).toBe("3");
    expect(document.querySelectorAll('[data-tour-target="3"]')).toHaveLength(1);
    const board = screen.getByTestId("tour-drop-board");
    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({ left: 200, right: 600, top: 0, bottom: 400, width: 400, height: 400, x: 200, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(file, { pointerId: 1, pointerType: "mouse", clientX: 20, clientY: 20 });
    fireEvent.pointerUp(screen.getByTestId("tour-act-one"), { pointerId: 1, pointerType: "mouse", clientX: 300, clientY: 200 });
    expect(done).toHaveBeenCalledWith(TOUR_PUSHED_CHAT.title);
    expect(document.querySelector('[data-tour-card="tour-card-2"]')).toBeTruthy();
  });

  it("advances act one on touch", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
    const file = screen.getByRole("button", { name: TOUR_PUSHED_CHAT.title });
    fireEvent.pointerDown(file, { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    fireEvent.pointerUp(screen.getByTestId("tour-act-one"), { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
    expect(done).toHaveBeenCalledWith(TOUR_PUSHED_CHAT.title);
    expect(document.querySelector('[data-tour-card="tour-card-2"]')).toBeTruthy();
  });

  it("advances act one after keyboard lift, move and drop", () => {
    const done = vi.fn();
    render(<TourActOne register="company" onComplete={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Add work" }));
    const file = screen.getByRole("button", { name: TOUR_PUSHED_CHAT.title });
    fireEvent.keyDown(file, { code: "Space", key: " " });
    fireEvent.keyDown(file, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyDown(file, { code: "Space", key: " " });
    expect(done).toHaveBeenCalledWith(TOUR_PUSHED_CHAT.title);
    expect(document.querySelector('[data-tour-card="tour-card-2"]')).toBeTruthy();
  });

  it("uses one pushed-chat identity across acts one, three and four", () => {
    const bringIn = actById("company", 3)?.bringIn;
    const primaryTwo = actById("company", 4)?.cards?.[2];
    expect(bringIn?.title).toBe(TOUR_PUSHED_CHAT.title);
    expect(bringIn?.source).toBe(TOUR_PUSHED_CHAT.source);
    expect(bringIn?.title).toBe(primaryTwo?.title);
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

  it("shows three distinct AI chats in free form regions without clipping titles", () => {
    render(<TourActTwo register="company" hint={false} onComplete={vi.fn()} />);
    const chats = Array.from(document.querySelectorAll<HTMLElement>(".tour-preview-card")).filter((card) => /ChatGPT:|Claude:|Gemini:/.test(card.textContent ?? ""));
    expect(chats).toHaveLength(4);
    expect(chats.filter((card) => card.textContent?.includes("ChatGPT:"))).toHaveLength(3);
    expect(chats.filter((card) => card.textContent?.includes("Claude:"))).toHaveLength(1);
    expect(chats.filter((card) => card.textContent?.includes("Gemini:"))).toHaveLength(0);
    expect(screen.queryByText("Claude: positioning lines")).toBeNull();
    expect(screen.getByLabelText("Loose AI chat work cards").classList.contains("tour-region")).toBe(false);
  });

  it("renders the exported context sentence after grouping", () => {
    render(<TourActThree register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add grouping" }));
    expect(screen.getByText(TOUR_CONTEXT_SENTENCE)).toBeTruthy();
  });

  it("groups act five by keyboard without changing the pointer or marquee paths", () => {
    const done = vi.fn();
    render(<TourActThree register="company" onComplete={done} />);
    fireEvent.keyDown(screen.getByTestId("tour-act-three"), { key: "Enter" });
    expect(done).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("button", { name: "Ask Lasso" }).hasAttribute("data-tour-target")).toBe(false);
    expect(screen.getByRole("button", { name: "Ask" }).getAttribute("data-tour-target")).toBe("6");
    expect(document.querySelectorAll('[data-tour-target="6"]')).toHaveLength(1);
    const question = screen.getByLabelText("Preset question");
    expect(question.getAttribute("contenteditable")).not.toBe("true");
    expect(question.getAttribute("aria-readonly")).toBe("true");
    expect(question.textContent).toBe("What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.");
  });

  it("shows the exact product scope labels and keeps alternative scopes inert", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<TourActFour register="company" onComplete={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    const scopes = screen.getByLabelText("Question scope");
    expect(within(scopes).getByText(askScopeWorkstreamLabel(actById("company", 5)?.frameTitle ?? "Workstream")).getAttribute("aria-current")).toBe("true");
    const one = within(scopes).getByRole("button", { name: ASK_SCOPE_ONE_LABEL });
    const all = within(scopes).getByRole("button", { name: ASK_SCOPE_ALL_LABEL });
    expect(one.getAttribute("aria-pressed")).toBe("false");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(one);
    fireEvent.click(all);
    act(() => vi.runOnlyPendingTimers());
    expect(document.querySelectorAll(".tour-ask-claim")).toHaveLength(0);
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Preset question").textContent).toBe(actById("company", 6)?.question);
    expect(screen.getByRole("button", { name: "Ask" }).getAttribute("data-tour-target")).toBe("6");
    vi.useRealTimers();
  });

  it("derives the act three heading count from the rendered layout", () => {
    render(<TourActOne register="company" onComplete={vi.fn()} />);
    const rendered = document.querySelectorAll('[data-tour-layout-id]:not([data-tour-layout-id="answer"])').length;
    expect(rendered).toBe(TOUR_BOARD_LAYOUT.filter((item) => item.earliestAct <= 3).length);
    expect(document.querySelector(".tour-board-heading span")?.textContent).toContain(`${rendered} pieces`);
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

  it("keeps an answer note on the board with three source links", () => {
    const landed = vi.fn();
    render(<TourActFive register="company" onLanded={landed} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(document.querySelector('[data-tour-layout-id="answer"]:not([data-tour-reserved])')).toBeTruthy();
    expect(screen.queryByTestId("tour-deck-slide")).toBeNull();
    expect(document.querySelectorAll('.tour-keep-links [role="button"]')).toHaveLength(3);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Launch deck, slide 12")).toBeTruthy();
    expect(screen.getByLabelText("Austin retail launch page")).toBeTruthy();
  });

  it("renders the deck as a slide with bullets and a chart from act three", () => {
    render(<TourActOne register="company" onComplete={vi.fn()} />);
    const deck = screen.getByLabelText("Launch deck, slide 12");
    expect(within(deck).getByText("Fall launch recommendation")).toBeTruthy();
    expect(deck.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
    expect(deck.querySelector('svg[aria-label="Decorative four bar chart"]')).toBeTruthy();
    expect(deck.querySelectorAll("svg rect")).toHaveLength(4);
  });

  it("renders the renamed screenshot frame and never renders removed cards in any board act", () => {
    for (const renderAct of [
      () => <TourActOne register="company" onComplete={vi.fn()} />,
      () => <TourActTwo register="company" hint={false} onComplete={vi.fn()} />,
      () => <TourActThree register="company" onComplete={vi.fn()} />,
      () => <TourActFour register="company" onComplete={vi.fn()} />,
      () => <TourActFive register="company" onLanded={vi.fn()} />,
      () => <TourActSix register="company" />,
    ]) {
      const rendered = render(renderAct());
      const screenshot = screen.getByLabelText(tourBoardCopy("company").whiteboardTitle);
      expect(screenshot.querySelector('svg[aria-label="Retail launch page screenshot frame"]')).toBeTruthy();
      for (const id of ["primary-4", "chat-2", "chat-3"]) expect(rendered.container.querySelector(`[data-tour-layout-id="${id}"]`)).toBeNull();
      rendered.unmount();
    }
  });

  it("keeps every margin note beside work that still exists", () => {
    render(<TourActOne register="company" onComplete={vi.fn()} />);
    expect(document.querySelector('[data-tour-note="budget"]')).toBeNull();
    const notes = Array.from(document.querySelectorAll<HTMLElement>("[data-tour-note-target]"));
    expect(notes.map((note) => [note.dataset["tourNote"], note.dataset["tourNoteTarget"]])).toEqual([["group", "primary-2"], ["gemini", "artifact"]]);
    for (const note of notes) expect(document.querySelector(`[data-tour-layout-id="${note.dataset["tourNoteTarget"]}"]`)).toBeTruthy();
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

  it("keeps the answer by keyboard as a note", () => {
    const landed = vi.fn();
    render(<TourActFive register="company" onLanded={landed} />);
    const keep = screen.getByRole("button", { name: "Keep" });
    expect(keep.tagName).toBe("BUTTON");
    expect(keep.getAttribute("tabindex")).not.toBe("-1");
    keep.focus();
    fireEvent.click(keep);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-tour-layout-id="answer"]:not([data-tour-reserved])')).toBeTruthy();
    expect(document.querySelectorAll('.tour-keep-links [role="button"]')).toHaveLength(3);
  });

  it("shows the deck slide with the three claims in source order", () => {
    render(<TourActSix register="company" />);
    const slide = screen.getByTestId("tour-deck-slide");
    expect(slide.getAttribute("data-tour-title")).toBe("Launch deck, slide 12");
    expect(within(slide).getByText("Launch deck, slide 12")).toBeTruthy();
    expect(within(slide).getByText(tourBoardCopy("company").owner)).toBeTruthy();
    expect(slide.textContent).not.toContain("LYKOS LOUNGEWEAR");
    const claims = actById("company", 6)?.answer ?? [];
    const bullets = Array.from(slide.querySelectorAll<HTMLElement>(".tour-deck-page li"));
    expect(bullets).toHaveLength(3);
    expect(bullets.map((bullet) => bullet.querySelector("span:last-child")?.textContent)).toEqual(claims.map((claim) => claim.text));
    expect(bullets.map((bullet) => bullet.dataset["sourceTitle"])).toEqual(claims.map((claim) => claim.sourceCardTitle));
    expect(document.querySelectorAll('.tour-keep-links [role="button"]')).toHaveLength(3);
  });

  it("uses each register's board owner in the slide header", () => {
    for (const register of ["company", "partner", "personal", "edu"] as const) {
      const rendered = render(<TourActSix register={register} />);
      expect(within(screen.getByTestId("tour-deck-slide")).getByText(tourBoardCopy(register).owner)).toBeTruthy();
      rendered.unmount();
    }
  });

  it("moves act seven's sole target from Keep to the deck action and gives act eight one final target", () => {
    function Harness({ start }: { start: 7 | 8 }) {
      const { renderers, instructionOverride, hint } = useTourActRenderers({ register: "company", activeAct: start, onAdvance: vi.fn(), onHintShown: vi.fn(), onFinish: vi.fn() });
      return <TourStage register="company" activeAct={start} acts={renderers} onSkip={vi.fn()} onBack={vi.fn()} onHintShown={hint} instructionOverride={instructionOverride} />;
    }
    const seven = render(<Harness start={7} />);
    expect(seven.container.querySelectorAll('[data-tour-target="7"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Keep" }).getAttribute("data-tour-target")).toBe("7");
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(seven.container.querySelectorAll('[data-tour-target="7"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "See it in the deck" }).getAttribute("data-tour-target")).toBe("7");
    seven.unmount();
    const eight = render(<Harness start={8} />);
    expect(eight.container.querySelectorAll('[data-tour-target="8"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Start with my own work" }).getAttribute("data-tour-target")).toBe("8");
    expect(screen.getByTestId("tour-deck-slide").hasAttribute("data-tour-target")).toBe(false);
  });

  it("uses the standalone mimic shape without importing the live data surface", () => {
    render(<TourActFour register="company" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Lasso" }));
    expect(screen.getByLabelText("Ask Lasso tour example")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
  });
});