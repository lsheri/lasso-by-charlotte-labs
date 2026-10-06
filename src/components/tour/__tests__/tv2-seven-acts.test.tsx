// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOUR_TURN_DELAY_MS, TourActArrived, TourActPush, useTourActRenderers } from "@/components/tour/TourActs";
import { TourStage } from "@/components/tour/TourStage";
import { TOUR_CHATGPT_CHAT, TOUR_CONTENT, TOUR_PUSHED_CHAT, actById, tourAmbientCards, tourBoardCopy, type TourActId } from "@/lib/tour-content";

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

describe("TV2 and TVc tour sequence", () => {
  it("has eight acts with ids one to eight and no gaps in every register", () => {
    for (const register of REGISTERS) {
      expect(TOUR_CONTENT[register].acts.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it("keeps the old acts in order at their new ids", () => {
    for (const register of REGISTERS) {
      expect(actById(register, 3)?.captionPointer).toBe("Drag the chat onto the board.");
      expect(actById(register, 3)?.captionTouch).toBe("Tap the chat to put it on the board.");
      expect(actById(register, 3)?.why).toBe("The chat you just pushed is now yours to place. Files, documents and call transcripts land the same way.");
      expect(actById(register, 3)?.bringIn).toEqual({ title: TOUR_PUSHED_CHAT.title, source: TOUR_PUSHED_CHAT.source });
      expect(actById(register, 7)?.captionPointer).toBe("Keep it. Now the answer lives next to what it came from.");
      expect(actById(register, 7)?.primaryActionLabel).toBe("See it in the deck");
      expect(actById(register, 8)?.primaryActionLabel).toBe("Start with my own work");
      expect(actById(register, 1)?.captionPointer).toBe("Push both into Lasso, then click Next.");
      expect(actById(register, 1)?.captionTouch).toBe("Push both into Lasso, then tap Next.");
      expect(actById(register, 1)?.why).toBe("Push work from either AI tool. When both are in Lasso, go to the next step.");
      expect(actById(register, 2)?.captionPointer).toBe("They are already here. Go to your workboard.");
      expect(actById(register, 2)?.captionTouch).toBe("They are already here. Go to your workboard.");
      expect(actById(register, 2)?.why).toBe("Both chats arrived on their own. Open Fall Marketing Launch to keep working.");
    }
  });

  it("plays both chats from the same timer and reveals each Push control on its own schedule", () => {
    vi.useFakeTimers();
    render(<TourActPush register="company" onReady={vi.fn()} />);
    const claude = screen.getByLabelText(`AI chat: ${TOUR_PUSHED_CHAT.title}`);
    const chatgpt = screen.getByLabelText(`AI chat: ${TOUR_CHATGPT_CHAT.title}`);
    expect(document.querySelectorAll(".tour-chat-turn")).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "Push to Lasso" })).toHaveLength(0);
    expect(TOUR_TURN_DELAY_MS).toBe(900);
    expect(TOUR_TURN_DELAY_MS).toBeGreaterThanOrEqual(700);
    act(() => vi.advanceTimersByTime(TOUR_TURN_DELAY_MS));
    expect(claude.querySelectorAll(".tour-chat-turn")).toHaveLength(1);
    expect(chatgpt.querySelectorAll(".tour-chat-turn")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(TOUR_TURN_DELAY_MS * TOUR_CHATGPT_CHAT.turns.length));
    expect(claude.querySelectorAll(".tour-chat-turn")).toHaveLength(6);
    expect(chatgpt.querySelectorAll(".tour-chat-turn")).toHaveLength(TOUR_CHATGPT_CHAT.turns.length + 1);
    expect(screen.queryAllByRole("button", { name: "Push to Lasso" })).toHaveLength(0);
    act(() => vi.advanceTimersByTime(TOUR_TURN_DELAY_MS));
    expect(within(chatgpt).getByRole("button", { name: "Push to Lasso" })).toBeTruthy();
    expect(within(claude).queryByRole("button", { name: "Push to Lasso" })).toBeNull();
    act(() => vi.advanceTimersByTime(TOUR_TURN_DELAY_MS * 3));
    expect(within(claude).getByRole("button", { name: "Push to Lasso" })).toBeTruthy();
  });

  it("plays a substantial alternating conversation that produces the board excerpt", () => {
    expect(TOUR_PUSHED_CHAT.turns.length).toBeGreaterThanOrEqual(7);
    TOUR_PUSHED_CHAT.turns.forEach((turn, index) => expect(turn.role).toBe(index % 2 === 0 ? "user" : "assistant"));
    const transcript = TOUR_PUSHED_CHAT.turns.map((turn) => turn.text).join(" ");
    const card = actById("company", 4)?.cards?.find((item) => item.title === TOUR_PUSHED_CHAT.title);
    expect(card?.preview).toEqual(["Compared TikTok first and retail first", "Outlined tradeoffs for each route"]);
    for (const line of card?.preview ?? []) expect(transcript).toContain(line);
    expect(TOUR_CHATGPT_CHAT.title).toBe("ChatGPT: launch week checklist");
    expect(TOUR_CHATGPT_CHAT.turns).toHaveLength(5);
    TOUR_CHATGPT_CHAT.turns.forEach((turn, index) => expect(turn.role).toBe(index % 2 === 0 ? "user" : "assistant"));
  });

  it("shows every turn and the Push control at once with reduced motion", () => {
    reducedMotion = true;
    vi.useFakeTimers();
    render(<TourActPush register="company" onReady={vi.fn()} />);
    expect(document.querySelectorAll(".tour-chat-turn")).toHaveLength(TOUR_PUSHED_CHAT.turns.length + TOUR_CHATGPT_CHAT.turns.length + 2);
    expect(screen.getAllByRole("button", { name: "Push to Lasso" })).toHaveLength(2);
    expect(document.querySelectorAll('[data-tour-target="1"]')).toHaveLength(2);
  });

  it("keeps act one open after either push and advances only through Next after both", () => {
    reducedMotion = true;
    render(<Harness />);
    const pushes = screen.getAllByRole("button", { name: "Push to Lasso" });
    fireEvent.click(pushes[0]!);
    expect(screen.queryByLabelText("All AI Conversations tour example")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(document.querySelectorAll('[data-tour-target="1"]')).toHaveLength(1);
    fireEvent.click(pushes[1]!);
    expect(document.querySelectorAll('[data-tour-target="1"]')).toHaveLength(1);
    const next = screen.getByRole("button", { name: "Next" });
    expect(next.getAttribute("data-tour-target")).toBe("1");
    fireEvent.click(next);
    expect(screen.getByLabelText("All AI Conversations tour example")).toBeTruthy();
    expect(screen.getByText("They are already here. Go to your workboard.")).toBeTruthy();
  });

  it("shows both pushed chats first while only the workboard row advances", () => {
    render(<Harness start={2} />);
    const rows = within(screen.getByRole("list", { name: "AI conversations" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2 + tourAmbientCards("company").length);
    expect(rows[0]?.textContent).toContain(TOUR_PUSHED_CHAT.title);
    expect(rows[0]?.textContent).toContain("Just arrived");
    expect(rows[1]?.textContent).toContain(TOUR_CHATGPT_CHAT.title);
    expect(rows[1]?.textContent).toContain("Just arrived");
    const arrived = within(rows[0]!).getByRole("button", { name: /Claude: channel mix options/ });
    expect(arrived.hasAttribute("data-tour-target")).toBe(false);
    fireEvent.click(arrived);
    expect(screen.queryByTestId("tour-act-one")).toBeNull();
    const board = screen.getByRole("button", { name: tourBoardCopy("company").title });
    expect(board.getAttribute("data-tour-target")).toBe("2");
    expect(document.querySelectorAll('[data-tour-target="2"]')).toHaveLength(1);
    expect(rows.slice(2).map((row) => row.querySelector(".ledger-work-note > .nb-paper-body > p")?.textContent)).toEqual(tourAmbientCards("company").map((card) => card.title));
    fireEvent.click(board);
    expect(screen.getByTestId("tour-act-one")).toBeTruthy();
    expect(screen.getByText("Drag the chat onto the board.")).toBeTruthy();
  });

  it("renders the real conversation-page shell and its inert controls", () => {
    const done = vi.fn();
    render(<TourActArrived register="company" onComplete={done} />);
    const mimic = screen.getByLabelText("All AI Conversations tour example");
    expect(mimic.classList.contains("nb-chatview")).toBe(true);
    expect(within(mimic).getByRole("heading", { name: "All AI Conversations" })).toBeTruthy();
    expect(within(mimic).getByPlaceholderText("Search your chats")).toBeTruthy();
    const inertControls = [
      within(mimic).getByRole("button", { name: "Add a chat" }),
      within(mimic).getByRole("button", { name: "Ask Lasso" }),
      within(mimic).getByRole("button", { name: "Workboards" }),
      within(mimic).getByRole("button", { name: `${2 + tourAmbientCards("company").length} conversations.` }),
    ];
    const toolFilters = within(mimic).getByRole("group", { name: "Filter by tool" }).querySelectorAll("button");
    expect(toolFilters).toHaveLength(4);
    for (const control of [...inertControls, ...toolFilters]) fireEvent.click(control);
    expect(done).not.toHaveBeenCalled();
    const rows = within(mimic).getAllByRole("listitem");
    expect(within(mimic).getByText(`${rows.length} conversations on the record · 2 new this week`)).toBeTruthy();
    expect(within(mimic).getByRole("button", { name: "Home" })).toBeTruthy();
    expect(within(mimic).getByRole("button", { name: "Inbox" })).toBeTruthy();
    expect(within(mimic).getByRole("button", { name: "All AI Conversations" })).toBeTruthy();
    expect(within(mimic).getByText("What landed")).toBeTruthy();
    expect(within(mimic).getByText("Where it goes")).toBeTruthy();
  });

  it("completes acts one and two by keyboard alone", async () => {
    reducedMotion = true;
    const ready = vi.fn();
    const arrived = vi.fn();
    const { unmount } = render(<TourActPush register="company" onReady={ready} />);
    const pushes = screen.getAllByRole("button", { name: "Push to Lasso" });
    for (const push of pushes) {
      expect(push.tagName).toBe("BUTTON");
      expect(push.getAttribute("tabindex")).not.toBe("-1");
      push.focus();
      fireEvent.click(push);
    }
    expect(ready).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Pushed to Lasso" })).toHaveLength(2);
    unmount();
    render(<TourActArrived register="company" onComplete={arrived} />);
    const row = screen.getByRole("button", { name: tourBoardCopy("company").title });
    expect(row.tagName).toBe("BUTTON");
    row.focus();
    expect(document.activeElement).toBe(row);
    fireEvent.click(row);
    fireEvent.click(row);
    expect(arrived).toHaveBeenCalledTimes(1);
  });

  it("draws eight rail marks", () => {
    reducedMotion = true;
    const { container } = render(<Harness />);
    expect(container.querySelectorAll(".tour-rail-segment")).toHaveLength(8);
    expect(screen.getByText("Step 1 of 8")).toBeTruthy();
  });
});
