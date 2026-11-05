// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-perf-timer", () => ({ usePerfOpenFinish: vi.fn() }));
vi.mock("@/components/reflect/ask-dock-state", () => ({ useAskDockState: () => ({ width: 360, tab: "history", setTab: vi.fn() }) }));
vi.mock("@/components/reflect/use-ask-lasso", () => ({ useAskLasso: () => ({ mapped: [], setBoardSelection: vi.fn(), historySettled: true, sessions: [], messages: [], newSession: vi.fn() }) }));
vi.mock("@/components/oneonone/SaveForOneOnOne", () => ({ SaveForOneOnOneDialog: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/components/reflect/AskSurface", async () => {
  const React = await import("react");
  return { AskBoardPickedContext: React.createContext(false), AskSurface: () => <div className="sticky" />, NbDots: () => null };
});
if (!("ResizeObserver" in globalThis)) (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} disconnect() {} };

import { BoardAsk } from "@/components/canvas-lab/BoardAsk";
import { AskDraftSurface } from "@/components/canvas-lab/ask-draft/AskDraftSurface";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";

const props = { engagementId: "board", engagementTitle: "Board", profileId: "person", orgId: "workspace", open: true, onOpenChange: vi.fn(), canKeep: false, onKeep: vi.fn(), boardContextItemIds: [], boardContextHasPicks: false };
afterEach(() => { cleanup(); window.localStorage.clear(); window.history.replaceState(null, "", "/"); });

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

function Harness({ messages }: { messages: unknown[] }) {
  const [tab, setTab] = useState<AskTab>("messages");
  const [pickerOpen, setPickerOpen] = useState(false);
  const host = document.body.querySelector("main") as HTMLElement;
  const ask = { messages, sessions: [], historySettled: true, pending: false, pickerOpen, error: null, newSession: vi.fn(), openSession: vi.fn() } as unknown as AskLasso;
  return (
    <>
      <button type="button" onClick={() => setPickerOpen(true)}>open card picker</button>
      <AskDraftSurface draft="b" host={host} ask={ask} tab={tab} onTab={setTab} engagementId="board" engagementTitle="Board" profileId="person" orgId="workspace" onClose={vi.fn()} />
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
