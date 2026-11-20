// @vitest-environment jsdom
// 20 Nov 2026, chat pill PR 1a (D-97): the pill opens, grows to full screen, tucks away, asks, refuses plainly, and on
// a board hands over to the board's own chat. Drags settle on the nearest mode.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPill } from "@/components/pill/ChatPill";
import { PILL_COPY } from "@/lib/chat-pill-shared";
import { FIRM_CANVAS_COPY } from "@/lib/firm-canvas-shared";
import { FIRM_ASK_COPY, type FirmAskResult } from "@/lib/firm-ask-shared";
import { FIRM_BRAIN_LIMIT_COPY } from "@/lib/firm-brain-limit-shared";

vi.mock("@/components/layout/BrandLockup", () => ({ BrandMark: () => <i data-mark="" /> }));
vi.mock("@/components/firm-brain/CiteThis", () => ({
  CiteThis: () => <span data-testid="cite-this" />,
}));

const ANSWER: FirmAskResult = {
  status: "answered",
  summary: null,
  claims: [
    {
      text: "Staffing reviews ran long when the client's data came late.",
      itemId: "i1",
      boardId: "b1",
      quote: "data came late",
      grade: "from_summary",
    },
    {
      text: "A weekly check-in with the sponsor kept them on time.",
      itemId: "i2",
      boardId: "b2",
      quote: "weekly check-in",
      grade: "from_summary",
    },
  ],
  facts: [],
  nearest: null,
  read: { full: [], summary: ["i1", "i2"] },
  sources: {
    i1: {
      title: "Close-out notes",
      type: "document",
      date: null,
      boardId: "b1",
      boardTitle: "Larkspur Senior Living",
      shownOn: null,
    },
    i2: {
      title: "Kickoff notes",
      type: "document",
      date: null,
      boardId: "b2",
      boardTitle: "Harrow Water District",
      shownOn: null,
    },
  },
  coverage: "Read 2 of 26 engagements.",
  oneSource: false,
};

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function pill(over: Partial<Parameters<typeof ChatPill>[0]> = {}) {
  const onAsk = vi.fn(async (_question: string): Promise<FirmAskResult> => ANSWER);
  const onOpenOnCanvas = vi.fn(async () => {});
  const onOpenSource = vi.fn();
  const onOpened = vi.fn();
  const onExpanded = vi.fn();
  const props = {
    brandName: "Lasso",
    askLabel: "Ask Lasso",
    firstName: "Maren",
    place: "home" as const,
    canAsk: true,
    questionMax: 500,
    starters: ["Which past engagements are most like Marrowfield?"],
    onAsk,
    onOpenOnCanvas,
    onOpenSource,
    onOpened,
    onExpanded,
    reduceMotion: true,
    ...over,
  };
  const view = render(
    <div data-lasso="on">
      <div data-pill-behind="" data-testid="behind" />
      <ChatPill {...props} />
    </div>,
  );
  const root = view.container.querySelector('[data-lasso="on"]') as HTMLElement;
  const el = screen.getByTestId("ask-the-firm");
  return {
    ...props,
    view,
    root,
    el,
    shut: () => screen.getByRole("button", { name: PILL_COPY.open("Lasso") }),
  };
}

describe("the shut pill", () => {
  it("shows the brand's Ask label and sits in the bottom right corner", () => {
    const { el } = pill();
    expect(el.getAttribute("data-mode")).toBe("shut");
    expect(el.textContent).toContain("Ask Lasso");
    expect(el.style.top).toBe(`${900 - 44 - 24}px`);
    expect(el.style.borderRadius).toBe("22px");
    // The panel is out of reach while shut.
    expect(el.querySelector('[role="dialog"]')?.getAttribute("aria-hidden")).toBe("true");
  });

  it("opens into the panel, says where you are and welcomes the person by name", () => {
    const { el, shut, onOpened } = pill({ place: "proposals" });
    fireEvent.click(shut());
    expect(el.getAttribute("data-mode")).toBe("open");
    expect(el.style.width).toBe("420px");
    expect(screen.getByText("On Proposals")).toBeTruthy();
    expect(screen.getByText("Hi Maren.")).toBeTruthy();
    expect(screen.getByText(PILL_COPY.footer)).toBeTruthy();
    expect(onOpened).toHaveBeenCalledWith("proposals");
  });

  it("grows to full screen and back, softening the page behind only while full", () => {
    const { el, root, shut, onExpanded } = pill();
    fireEvent.click(shut());
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.grow }));
    expect(el.getAttribute("data-mode")).toBe("full");
    expect(root.hasAttribute("data-pill-full")).toBe(true);
    expect(onExpanded).toHaveBeenCalledWith("home");
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.shrink }));
    expect(el.getAttribute("data-mode")).toBe("open");
    expect(root.hasAttribute("data-pill-full")).toBe(false);
  });

  it("tucks away with its button or Escape", () => {
    const { el, shut } = pill();
    fireEvent.click(shut());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(el.getAttribute("data-mode")).toBe("shut");
    fireEvent.click(shut());
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.close }));
    expect(el.getAttribute("data-mode")).toBe("shut");
  });
});

describe("asking", () => {
  const send = (text: string) => {
    fireEvent.change(screen.getByLabelText(PILL_COPY.label), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.send }));
  };

  it("builds the answer in the chat with the canvas's own card, each line with its source", async () => {
    const { shut, onAsk, onOpenSource } = pill();
    fireEvent.click(shut());
    send("  How did we run staffing reviews?  ");
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith("How did we run staffing reviews?"));
    expect(screen.getByText(PILL_COPY.looking)).toBeTruthy();
    const card = await screen.findByTestId("chat-answer");
    await waitFor(() => expect(card.getAttribute("data-firm-answer")).toBe("answered"));
    expect(card.textContent).toContain("Staffing reviews ran long");
    expect(card.textContent).toContain(FIRM_CANVAS_COPY.done(2, 2));
    fireEvent.click(
      screen.getByRole("button", { name: `${FIRM_CANVAS_COPY.source}: Larkspur Senior Living` }),
    );
    expect(onOpenSource).toHaveBeenCalledWith("i1");
  });

  it("opens the finished answer on the canvas without asking again, and tucks the chat away", async () => {
    const { el, shut, onAsk, onOpenOnCanvas } = pill();
    fireEvent.click(shut());
    send("How did we run staffing reviews?");
    fireEvent.click(await screen.findByRole("button", { name: PILL_COPY.openOnCanvas }));
    await waitFor(() =>
      expect(onOpenOnCanvas).toHaveBeenCalledWith("How did we run staffing reviews?", ANSWER),
    );
    expect(onAsk).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(el.getAttribute("data-mode")).toBe("shut"));
  });

  it("offers no canvas for an answer that found nothing, and says so", async () => {
    const empty: FirmAskResult = {
      ...ANSWER,
      status: "not_found",
      claims: [],
      sources: {},
      nearest: "Larkspur Senior Living",
    };
    const { shut } = pill({ onAsk: vi.fn(async () => empty) });
    fireEvent.click(shut());
    send("How did we price a lunar habitat?");
    const card = await screen.findByTestId("chat-answer");
    await waitFor(() => expect(card.getAttribute("data-firm-answer")).toBe("not_found"));
    expect(card.textContent).toContain(FIRM_ASK_COPY.notFound);
    expect(screen.queryByRole("button", { name: PILL_COPY.openOnCanvas })).toBeNull();
  });

  it("asks a starter with one press", async () => {
    const { shut, onAsk } = pill();
    fireEvent.click(shut());
    fireEvent.click(
      screen.getByRole("button", { name: "Which past engagements are most like Marrowfield?" }),
    );
    await waitFor(() =>
      expect(onAsk).toHaveBeenCalledWith("Which past engagements are most like Marrowfield?"),
    );
  });

  it("asks once on Enter, keeps Shift+Enter for a new line, and sends nothing too short", async () => {
    const { shut, onAsk } = pill();
    fireEvent.click(shut());
    const box = screen.getByLabelText(PILL_COPY.label);
    fireEvent.change(box, { target: { value: "ok" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect((await screen.findByRole("alert")).textContent).toBe(PILL_COPY.tooShort);
    expect(onAsk).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "What went wrong last time?" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onAsk).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(1));
  });

  it("keeps the failed card open with a plain line and tries the same question again", async () => {
    const onAsk = vi
      .fn<(q: string) => Promise<FirmAskResult>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(ANSWER);
    const { el, shut } = pill({ onAsk });
    fireEvent.click(shut());
    send("What went wrong last time?");
    expect((await screen.findByRole("alert")).textContent).toContain(FIRM_CANVAS_COPY.failed);
    expect(el.getAttribute("data-mode")).toBe("open");
    fireEvent.click(screen.getByRole("button", { name: FIRM_CANVAS_COPY.tryAgain }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(2));
    expect(onAsk.mock.calls[1]![0]).toBe("What went wrong last time?");
    await waitFor(() =>
      expect(screen.getByTestId("chat-answer").getAttribute("data-firm-answer")).toBe("answered"),
    );
  });

  it("says the daily limit was reached, with no Try again", async () => {
    const { shut } = pill({
      onAsk: vi.fn(async () => Promise.reject(new Response("limit", { status: 429 }))),
    });
    fireEvent.click(shut());
    send("What went wrong last time?");
    expect((await screen.findByRole("alert")).textContent).toContain(FIRM_BRAIN_LIMIT_COPY.shown);
    expect(screen.queryByRole("button", { name: FIRM_CANVAS_COPY.tryAgain })).toBeNull();
  });

  it("takes no second question while one is being read", async () => {
    let finish: (value: FirmAskResult) => void = () => {};
    const onAsk = vi.fn(() => new Promise<FirmAskResult>((resolve) => (finish = resolve)));
    const { shut } = pill({ onAsk });
    fireEvent.click(shut());
    send("What went wrong last time?");
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText(PILL_COPY.label) as HTMLTextAreaElement).disabled).toBe(true);
    finish(ANSWER);
    await waitFor(() =>
      expect((screen.getByLabelText(PILL_COPY.label) as HTMLTextAreaElement).disabled).toBe(false),
    );
  });

  it("offers no question box to someone who may not ask the firm", () => {
    const { shut } = pill({ canAsk: false, starters: [] });
    fireEvent.click(shut());
    expect(screen.queryByLabelText(PILL_COPY.label)).toBeNull();
    expect(screen.getByText(PILL_COPY.welcomeNone)).toBeTruthy();
  });
});

describe("on a board", () => {
  it("opens the board's own chat instead of the panel", () => {
    const boardChat = vi.fn();
    const { el } = pill({ place: "board", boardChat });
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.openBoardChat }));
    expect(boardChat).toHaveBeenCalledTimes(1);
    expect(el.getAttribute("data-mode")).toBe("shut");
    expect(el.textContent).toContain("On this board");
  });
});

describe("dragging", () => {
  // A slow hand: a second between every reading, so no flick carries the drag past where it was let go.
  const slowClock = () => {
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (t += 1000));
  };
  const drag = (target: HTMLElement, path: [number, number][]) => {
    const [start, ...rest] = path;
    fireEvent.pointerDown(target, {
      pointerId: 1,
      button: 0,
      clientX: start![0],
      clientY: start![1],
    });
    for (const [x, y] of rest)
      fireEvent.pointerMove(target, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerUp(target, {
      pointerId: 1,
      clientX: rest.at(-1)![0],
      clientY: rest.at(-1)![1],
    });
  };

  it("pulling the pill up far enough opens it, and a drag is not also a tap", () => {
    slowClock();
    const { el, shut } = pill();
    drag(shut(), [
      [1300, 850],
      [1300, 700],
      [1300, 450],
    ]);
    expect(el.getAttribute("data-mode")).toBe("open");
  });

  it("pulling the open panel's head up past half way makes it full screen; down tucks it away", () => {
    slowClock();
    const { el, shut } = pill();
    fireEvent.click(shut());
    const head = el.querySelector(".chat-pill__head") as HTMLElement;
    drag(head, [
      [1200, 200],
      [1200, 100],
      [1200, -20],
    ]);
    expect(el.getAttribute("data-mode")).toBe("full");
    drag(head, [
      [1200, 100],
      [1200, 900],
      [1200, 1700],
    ]);
    expect(el.getAttribute("data-mode")).toBe("shut");
  });

  it("a small wobble is still a tap", () => {
    const { el, shut } = pill();
    act(() => {
      fireEvent.pointerDown(shut(), { pointerId: 1, button: 0, clientX: 1300, clientY: 850 });
      fireEvent.pointerMove(shut(), { pointerId: 1, clientX: 1302, clientY: 848 });
      fireEvent.pointerUp(shut(), { pointerId: 1, clientX: 1302, clientY: 848 });
    });
    fireEvent.click(shut());
    expect(el.getAttribute("data-mode")).toBe("open");
  });
});
