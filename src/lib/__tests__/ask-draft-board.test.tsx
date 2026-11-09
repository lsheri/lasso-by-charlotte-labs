// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-perf-timer", () => ({ usePerfOpenFinish: vi.fn() }));
vi.mock("@/components/reflect/ask-dock-state", () => ({ useAskDockState: () => ({ width: 360, tab: "history", setTab: vi.fn() }) }));
vi.mock("@/components/reflect/use-ask-lasso", () => ({ useAskLasso: () => ({ mapped: [], setBoardSelection: vi.fn(), setBoardPickedVideos: vi.fn(), historySettled: true, sessions: [], messages: [], newSession: vi.fn() }) }));
vi.mock("@/components/oneonone/SaveForOneOnOne", () => ({ SaveForOneOnOneDialog: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/components/reflect/AskSurface", async () => {
  const React = await import("react");
  return { AskBoardPickedContext: React.createContext(false), AskSurface: ({ sendAside }: { sendAside?: React.ReactNode }) => <div className="sticky">{sendAside}</div>, NbDots: () => null };
});
if (!("ResizeObserver" in globalThis)) (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} disconnect() {} };

import { BoardAsk } from "@/components/canvas-lab/BoardAsk";
import { AskDraftSurface } from "@/components/canvas-lab/ask-draft/AskDraftSurface";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";

const props = { engagementId: "board", engagementTitle: "Board", profileId: "person", orgId: "workspace", open: true, onOpenChange: vi.fn(), canKeep: false, onKeep: vi.fn(), boardContextItemIds: [], boardContextHasPicks: false };
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.localStorage.clear(); window.history.replaceState(null, "", "/"); });

describe("ASK-D1 BoardAsk gate", () => {
  it("with the gate closed renders the existing side panel", async () => {
    // ASK-B1: preview hosts default to draft b, so the gate is closed with ask=off.
    window.history.replaceState(null, "", "/?ask=off");
    const host = document.createElement("main");
    document.body.appendChild(host);
    const { baseElement } = render(<BoardAsk {...props} floatHost={host} />);
    await waitFor(() => expect(baseElement.querySelector("aside[aria-label='Ask Lasso']")).not.toBeNull());
    expect(baseElement.querySelector(".ask-draft")).toBeNull();
  });
  it("with ask=b on localhost floats draft b inside the board", async () => {
    window.history.replaceState(null, "", "/?ask=b");
    const host = document.createElement("main");
    document.body.appendChild(host);
    render(<BoardAsk {...props} floatHost={host} />);
    await waitFor(() => expect(host.querySelector(".ask-draft-b")).not.toBeNull());
    expect(host.querySelector(".ask-draft")?.getAttribute("data-position")).toBe("bottom_right");
  });
});

function Harness({ messages, pending = false, readingNodeIds, pinnedNodeId, wasPinned, startTab = "messages" }: { messages: unknown[]; pending?: boolean; readingNodeIds?: string[]; pinnedNodeId?: string | null; wasPinned?: boolean; startTab?: AskTab }) {
  const [tab, setTab] = useState<AskTab>(startTab);
  const [pickerOpen, setPickerOpen] = useState(false);
  const host = document.body.querySelector("main") as HTMLElement;
  const ask = { messages, sessions: [], historySettled: true, pending, pickerOpen, error: null, newSession: vi.fn(), openSession: vi.fn() } as unknown as AskLasso;
  return (
    <>
      <button type="button" onClick={() => setPickerOpen(true)}>open card picker</button>
      <AskDraftSurface draft="b" host={host} ask={ask} tab={tab} onTab={setTab} engagementId="board" engagementTitle="Board" profileId="person" orgId="workspace" onClose={vi.fn()} readingNodeIds={readingNodeIds} pinnedNodeId={pinnedNodeId} wasPinned={wasPinned} />
    </>
  );
}

describe("ASK-B2 header and foot", () => {
  it("has no collapse button on an empty chat and one once there are messages", () => {
    document.body.appendChild(document.createElement("main"));
    const { unmount } = render(<Harness messages={[]} />);
    expect(screen.queryByRole("button", { name: "Collapse Ask Lasso" })).toBeNull();
    unmount();
    render(<Harness messages={[{ id: "m1", role: "user", content: "hi" }]} />);
    expect(screen.getByRole("button", { name: "Collapse Ask Lasso" })).toBeTruthy();
  });
  it("foot reads Past conversations, then Back to this chat", () => {
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={[{ id: "m1", role: "user", content: "hi" }]} />);
    const foot = screen.getByRole("button", { name: "Past conversations" });
    fireEvent.click(foot);
    expect(screen.getByRole("button", { name: "Back to this chat" })).toBeTruthy();
  });
  it("ASK-B2a: opening the card picker unfolds a folded chat", () => {
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={[{ id: "m1", role: "user", content: "hi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse Ask Lasso" }));
    expect(screen.getByRole("button", { name: "Expand Ask Lasso" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "open card picker" }));
    expect(screen.getByRole("button", { name: "Collapse Ask Lasso" })).toBeTruthy();
  });
});

describe("ASK-LOOK-1 reading lines, LOOK-2 still mark", () => {
  const msgs = [{ id: "m1", role: "user", content: "hi" }];
  it("LOOK-2: the mark is the still loop while pending and after, never the signature mark", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement, unmount } = render(<Harness messages={msgs} pending />);
    expect(baseElement.querySelector(".ask-draft-mark svg")).not.toBeNull();
    expect(baseElement.querySelector('[data-lasso-thinking-mark="signature"]')).toBeNull();
    unmount();
    const second = render(<Harness messages={msgs} />);
    expect(second.baseElement.querySelector(".ask-draft-mark svg")).not.toBeNull();
  });
  it("pending with reading ids renders the lines", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement } = render(<Harness messages={msgs} pending readingNodeIds={["n1"]} />);
    expect(baseElement.querySelector(".ask-reading-lines")).not.toBeNull();
  });
  it("not pending with reading ids renders no lines and no signature mark", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement } = render(<Harness messages={msgs} readingNodeIds={["n1"]} />);
    expect(baseElement.querySelector(".ask-reading-lines")).toBeNull();
    expect(baseElement.querySelector('[data-lasso-thinking-mark="signature"]')).toBeNull();
  });
  it("section carries data-thinking only while pending", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement, unmount } = render(<Harness messages={msgs} pending />);
    expect(baseElement.querySelector(".ask-draft")?.getAttribute("data-thinking")).toBe("true");
    unmount();
    const second = render(<Harness messages={msgs} />);
    expect(second.baseElement.querySelector(".ask-draft")?.hasAttribute("data-thinking")).toBe(false);
  });
  it("keeps the title text Ask Lasso", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement } = render(<Harness messages={msgs} />);
    expect(baseElement.querySelector(".ask-draft-title")?.textContent).toBe("Ask Lasso");
  });
});

describe("ASK-B3 resize handles", () => {
  const msgs = [{ id: "m1", role: "user", content: "hi" }];
  const edges = () => Array.from(document.querySelectorAll(".ask-draft-edge")).map((e) => e.getAttribute("data-edge"));
  it("absent on an empty chat", () => {
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={[]} />);
    expect(edges()).toEqual([]);
  });
  it("absent when locked", () => {
    window.localStorage.setItem("lasso.ask-draft.pos.b", JSON.stringify({ to: "lock_left" }));
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={msgs} />);
    expect(edges()).toEqual([]);
  });
  it("top only when docked at the bottom with messages", () => {
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={msgs} />);
    expect(edges()).toEqual(["top"]);
    expect(screen.getByRole("separator", { name: "Make Ask Lasso longer or shorter" }).getAttribute("aria-valuemin")).not.toBeNull();
  });
  it("top and bottom when free", () => {
    window.localStorage.setItem("lasso.ask-draft.pos.b", JSON.stringify({ to: "free", x: 200, y: 200 }));
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={msgs} />);
    expect(edges()).toEqual(["top", "bottom"]);
  });
});

describe("PIN-1 header pin", () => {
  const msgs = [{ id: 1, role: "user", content: "hi" }, { id: 2, role: "assistant", content: "An answer" }];
  it("ASK-C1: idle on an empty chat and absent on the history tab", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement, unmount } = render(<Harness messages={[]} />);
    const pin = screen.getByRole("button", { name: "Ask something first, then pin the answer here" });
    expect(pin.getAttribute("data-idle")).toBe("true");
    expect((pin as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Continue in Claude" }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    const second = render(<Harness messages={msgs} startTab="history" />);
    expect(second.baseElement.querySelector(".ask-draft-pin")).toBeNull();
  });
  it("present with messages, and the label flips with pinnedNodeId", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement, unmount } = render(<Harness messages={msgs} />);
    expect(baseElement.querySelector(".ask-draft-pin")?.getAttribute("aria-label")).toBe("Pin this chat to the board");
    unmount();
    const second = render(<Harness messages={msgs} pinnedNodeId="answer:1" />);
    const pin = second.baseElement.querySelector(".ask-draft-pin");
    expect(pin?.getAttribute("aria-label")).toBe("Take off the board");
    expect(pin?.getAttribute("data-on")).toBe("true");
  });
  it("wasPinned gives the dashed again label", () => {
    document.body.appendChild(document.createElement("main"));
    const { baseElement } = render(<Harness messages={msgs} wasPinned />);
    const pin = baseElement.querySelector(".ask-draft-pin");
    expect(pin?.getAttribute("aria-label")).toBe("Pin this chat again");
    expect(pin?.getAttribute("data-was")).toBe("true");
  });
  it("FIX-1: pin while free returns the chat to its saved home", () => {
    window.localStorage.setItem("lasso.ask-draft.home", "lock_left");
    window.localStorage.setItem("lasso.ask-draft.pos.b", JSON.stringify({ to: "free", x: 200, y: 200 }));
    document.body.appendChild(document.createElement("main"));
    const { baseElement } = render(<Harness messages={msgs} />);
    expect(baseElement.querySelector(".ask-draft")?.getAttribute("data-position")).toBe("free");
    fireEvent.click(baseElement.querySelector(".ask-draft-pin") as HTMLElement);
    expect(baseElement.querySelector(".ask-draft")?.getAttribute("data-position")).toBe("lock_left");
  });
});

describe("SET-1 New ask goes home, closed", () => {
  it("clicking New ask moves to the saved home and folds", () => {
    window.localStorage.setItem("lasso.ask-draft.home", "lock_left");
    document.body.appendChild(document.createElement("main"));
    const { baseElement } = render(<Harness messages={[{ id: "m1", role: "user", content: "hi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "New ask" }));
    expect(baseElement.querySelector(".ask-draft")?.getAttribute("data-position")).toBe("lock_left");
    expect(screen.getByRole("button", { name: "Expand Ask Lasso" })).toBeTruthy();
    window.localStorage.removeItem("lasso.ask-draft.home");
  });
});

describe("HAND-1 Continue conversations", () => {
  it("ASK-C1: a user message alone cannot enable pin or handoff", () => {
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={[{ role: "user", content: "A question" }]} />);
    const pin = screen.getByRole("button", { name: "Ask something first, then pin the answer here" }) as HTMLButtonElement;
    expect(pin.disabled).toBe(true);
    expect(pin.getAttribute("data-idle")).toBe("true");
    expect((screen.getByRole("button", { name: "Continue in Claude" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("copies the prompt and opens Claude beside Send, not from the header", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={[{ role: "assistant", content: "An answer" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue in Claude" }));
    expect(document.querySelector(".ask-draft-head .ask-draft-handoff")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue in Claude" }).closest(".sticky")).not.toBeNull();
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://claude.ai/new", "_blank"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Lasso: An answer"));
    expect(screen.getByRole("status").textContent).toBe("Pop-up blocked. The prompt is on your clipboard.");
  });
  it("FIX-1: opens the window before the clipboard write, and says copied when it opened", async () => {
    const order: string[] = [];
    const writeText = vi.fn(async () => { order.push("clipboard"); });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.spyOn(window, "open").mockImplementation(() => { order.push("open"); return {} as Window; });
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={[{ role: "assistant", content: "An answer" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue in Claude" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Prompt copied. Paste it there to carry on."));
    expect(order).toEqual(["open", "clipboard"]);
  });
  it("offers the six-turn nudge and Not now hides it", () => {
    document.body.appendChild(document.createElement("main"));
    render(<Harness messages={Array.from({ length: 6 }, (_, i) => ({ role: "assistant", content: `Answer ${i}` }))} />);
    expect(screen.getByText("This is a long one. Keep what matters to the board, or carry it on in Claude with the board as context.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("button", { name: "Not now" })).toBeNull();
  });
});
