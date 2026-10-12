// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";

const state = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => state.mobile }));
vi.mock("@/hooks/use-perf-timer", () => ({ usePerfOpenFinish: vi.fn() }));
vi.mock("@/components/reflect/ask-dock-state", () => ({ useAskDockState: () => ({ width: 360, tab: "history", setTab: vi.fn() }) }));
vi.mock("@/components/reflect/use-ask-lasso", () => ({ useAskLasso: () => ({ mapped: [], setBoardSelection: vi.fn(), historySettled: true, sessions: [], newSession: vi.fn() }) }));
vi.mock("@/components/oneonone/SaveForOneOnOne", () => ({ SaveForOneOnOneDialog: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: () => null,
  SheetDescription: () => null,
}));

import { AskSurface } from "@/components/reflect/AskSurface";
import { AskSheet } from "@/components/reflect/AskSheet";
import { BoardAsk } from "@/components/canvas-lab/BoardAsk";

const scope = { engagementId: "board", engagementTitle: "Board", profileId: "person", orgId: "workspace" };
afterEach(() => { cleanup(); state.mobile = false; });
describe("BE-1 board-only lime header", () => {
  it.each([false, true])("board header is lime without rope (phone=%s)", (mobile) => {
    state.mobile = mobile;
    const { baseElement } = render(<BoardAsk {...scope} open onOpenChange={vi.fn()} canKeep={false} onKeep={vi.fn()} boardContextItemIds={[]} boardContextHasPicks={false} />);
    const mark = baseElement.querySelector("header canvas");
    expect(mark?.getAttribute("data-thinking")).toBe("true");
    expect(mark?.getAttribute("data-rope")).toBe("false");
    expect(mark?.getAttribute("width")).toBe("28");
  });
  it("non-board surface defaults to graphite with rope", () => {
    const ask = { historySettled: true, sessions: [] } as unknown as AskLasso;
    const { container } = render(<AskSurface {...scope} ask={ask} tab="history" onTab={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelector("header canvas")?.getAttribute("data-thinking")).toBe("false");
    expect(container.querySelector("header canvas")?.getAttribute("data-rope")).toBe("true");
  });
  it("non-board phone sheet keeps the default graphite mark", () => {
    const { container } = render(<AskSheet {...scope} open onOpenChange={vi.fn()} />);
    expect(container.querySelector("header canvas")?.getAttribute("data-thinking")).toBe("false");
    expect(container.querySelector("header canvas")?.getAttribute("data-rope")).toBe("true");
  });
});