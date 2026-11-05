// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/reflect/AskSurface", () => ({ NbDots: () => null }));

import { AskPastList } from "@/components/canvas-lab/ask-draft/AskPastList";

const sessions = [{ id: "s1", title: "Pricing chat", created_at: "2026-11-01T00:00:00Z" }, { id: "s2", title: "Other chat", created_at: "2026-11-02T00:00:00Z" }];
const ask = (rows: typeof sessions) => ({ sessions: rows, historySettled: true, sessionId: null }) as never;
const pinned = [{ nodeId: "answer:1", durableId: "d1", text: "First line of the answer\\nsecond" }];

afterEach(() => { cleanup(); window.localStorage.clear(); });

describe("ASK-B2 AskPastList", () => {
  it("renders both groups", () => {
    render(<AskPastList ask={ask(sessions)} pinned={pinned} onOpen={vi.fn()} onJump={vi.fn()} />);
    expect(screen.getByText("Pinned on this board")).toBeTruthy();
    expect(screen.getByText("Past conversations")).toBeTruthy();
  });
  it("a pinned row calls onJump with the node id", () => {
    const onJump = vi.fn();
    render(<AskPastList ask={ask([])} pinned={pinned} onOpen={vi.fn()} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: /First line of the answer/ }));
    expect(onJump).toHaveBeenCalledWith("answer:1");
  });
  it("a session row calls onOpen with the session id", () => {
    const onOpen = vi.fn();
    render(<AskPastList ask={ask(sessions)} pinned={[]} onOpen={onOpen} onJump={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Pricing chat/ }));
    expect(onOpen).toHaveBeenCalledWith("s1");
  });
  it("shows the empty line with no sessions and no pins", () => {
    render(<AskPastList ask={ask([])} pinned={[]} onOpen={vi.fn()} onJump={vi.fn()} />);
    expect(screen.getByText("No earlier chats on this workboard yet.")).toBeTruthy();
  });
  it("a session in readAskPins shows the pin", () => {
    window.localStorage.setItem("lasso.ask-draft.pins", JSON.stringify({ d1: "s1" }));
    render(<AskPastList ask={ask(sessions)} pinned={[]} onOpen={vi.fn()} onJump={vi.fn()} />);
    expect(screen.getAllByTestId("ask-past-pin")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Pricing chat/ }).querySelector("[data-testid='ask-past-pin']")).not.toBeNull();
  });
});
