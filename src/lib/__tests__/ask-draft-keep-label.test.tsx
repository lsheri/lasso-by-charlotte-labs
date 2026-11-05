// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-perf-timer", () => ({ usePerfOpenFinish: vi.fn() }));
vi.mock("@/components/reflect/ask-dock-state", () => ({ useAskDockState: () => ({ width: 360, tab: "messages", setTab: vi.fn() }) }));
vi.mock("@/components/reflect/use-ask-lasso", () => ({ useAskLasso: () => ({
  mapped: [], setBoardSelection: vi.fn(), historySettled: true, sessions: [], newSession: vi.fn(), sessionId: "s1",
  messages: [{ id: 1, role: "user", content: "Q", created_at: "2026-11-05T08:00:00Z" }, { id: 2, role: "assistant", content: "The answer", created_at: "2026-11-05T08:00:01Z", context_manifest: null }],
  sourcesByMessage: {}, pending: false, draft: "", mentionMatches: [], selectedItems: [], composerRef: { current: null }, bottomRef: { current: null },
}) }));
vi.mock("@/components/oneonone/SaveForOneOnOne", () => ({ SaveForOneOnOneDialog: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { BoardAsk } from "@/components/canvas-lab/BoardAsk";

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("ASK-D2 closed gate keep", () => {
  it("reads Put on board and keeps exactly as before", () => {
    const onKeep = vi.fn();
    render(<BoardAsk engagementId="b" engagementTitle="B" profileId="p" orgId="o" open onOpenChange={vi.fn()} canKeep onKeep={onKeep} boardContextItemIds={[]} boardContextHasPicks={false} />);
    const button = screen.getByRole("button", { name: /Put on board/ });
    expect(screen.queryByText("Pin to board")).toBeNull();
    fireEvent.click(button);
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onKeep.mock.calls[0]).toEqual([{ messageId: 2, text: "The answer", reads: [] }, "button"]);
  });
});
