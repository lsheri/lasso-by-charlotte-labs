// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-perf-timer", () => ({ usePerfOpenFinish: vi.fn() }));
vi.mock("@/components/reflect/ask-dock-state", () => ({ useAskDockState: () => ({ width: 360, tab: "history", setTab: vi.fn() }) }));
vi.mock("@/components/reflect/use-ask-lasso", () => ({ useAskLasso: () => ({ mapped: [], setBoardSelection: vi.fn(), historySettled: true, sessions: [], messages: [], newSession: vi.fn() }) }));
vi.mock("@/components/oneonone/SaveForOneOnOne", () => ({ SaveForOneOnOneDialog: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
if (!("ResizeObserver" in globalThis)) (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} disconnect() {} };

import { BoardAsk } from "@/components/canvas-lab/BoardAsk";

const props = { engagementId: "board", engagementTitle: "Board", profileId: "person", orgId: "workspace", open: true, onOpenChange: vi.fn(), canKeep: false, onKeep: vi.fn(), boardContextItemIds: [], boardContextHasPicks: false };
afterEach(() => { cleanup(); window.localStorage.clear(); window.history.replaceState(null, "", "/"); });

describe("ASK-D1 BoardAsk gate", () => {
  it("with the gate closed renders the existing side panel", async () => {
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
