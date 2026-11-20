// @vitest-environment jsdom
// 20 Nov 2026, chat pill PR 1a (D-97): the pill opens, grows to full screen, tucks away, asks, refuses plainly, and on
// a board hands over to the board's own chat. Drags settle on the nearest mode.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPill } from "@/components/pill/ChatPill";
import { PILL_COPY } from "@/lib/chat-pill-shared";

vi.mock("@/components/layout/BrandLockup", () => ({ BrandMark: () => <i data-mark="" /> }));

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
  const onAsk = vi.fn(async () => ({ ok: true as const }));
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
  const el = screen.getByTestId("chat-pill");
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
  it("sends the question, says where the answer opens, and tucks itself away", async () => {
    const { el, shut, onAsk } = pill();
    fireEvent.click(shut());
    fireEvent.change(screen.getByLabelText(PILL_COPY.label), {
      target: { value: "  How did we run staffing reviews?  " },
    });
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.send }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith("How did we run staffing reviews?"));
    expect(await screen.findByText(PILL_COPY.toCanvas)).toBeTruthy();
    expect(screen.getByText("How did we run staffing reviews?")).toBeTruthy();
    // The line is held long enough to read before the chat tucks itself away (QA M1 of PR 289).
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(el.getAttribute("data-mode")).toBe("open");
    await waitFor(() => expect(el.getAttribute("data-mode")).toBe("shut"), { timeout: 3000 });
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
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onAsk).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "What went wrong last time?" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onAsk).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(1));
  });

  it("keeps the chat open with a plain line when asking is refused or fails", async () => {
    const refused = pill({
      onAsk: vi.fn(async () => ({
        ok: false as const,
        problem: "Today's limit for the firm brain has been reached.",
      })),
    });
    fireEvent.click(refused.shut());
    fireEvent.change(screen.getByLabelText(PILL_COPY.label), {
      target: { value: "What went wrong last time?" },
    });
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.send }));
    expect((await screen.findByRole("alert")).textContent).toContain("Today's limit");
    expect(refused.el.getAttribute("data-mode")).toBe("open");
    cleanup();
    const failed = pill({ onAsk: vi.fn(async () => Promise.reject(new Error("offline"))) });
    fireEvent.click(failed.shut());
    fireEvent.change(screen.getByLabelText(PILL_COPY.label), {
      target: { value: "What went wrong last time?" },
    });
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.send }));
    expect((await screen.findByRole("alert")).textContent).toBe(PILL_COPY.failed);
  });

  it("offers no question box to someone who may not ask the firm", () => {
    const { shut } = pill({ canAsk: false, starters: [] });
    fireEvent.click(shut());
    expect(screen.queryByLabelText(PILL_COPY.label)).toBeNull();
    expect(screen.getByText(PILL_COPY.welcomeNone)).toBeTruthy();
  });
});

describe("QA of PR 289", () => {
  it("leaves Escape to a dialog open over the pill", () => {
    const { el, shut } = pill();
    fireEvent.click(shut());
    const handler = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener("keydown", handler, { capture: true });
    fireEvent.keyDown(window, { key: "Escape" });
    window.removeEventListener("keydown", handler, { capture: true });
    expect(el.getAttribute("data-mode")).toBe("open");
  });

  it("on a phone, gives focus to the panel itself so a screen reader says what opened", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    const { shut } = pill();
    fireEvent.click(shut());
    const panel = screen.getByRole("dialog", { name: PILL_COPY.panel("Lasso") });
    await waitFor(() => expect(document.activeElement).toBe(panel));
    expect(document.activeElement).not.toBe(screen.getByLabelText(PILL_COPY.label));
  });

  it("is a modal dialog only when full screen", () => {
    const { shut } = pill();
    fireEvent.click(shut());
    const panel = screen.getByRole("dialog", { name: PILL_COPY.panel("Lasso") });
    expect(panel.getAttribute("aria-modal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: PILL_COPY.grow }));
    expect(panel.getAttribute("aria-modal")).toBe("true");
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
