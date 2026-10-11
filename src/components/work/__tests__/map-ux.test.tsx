// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapDialog, COPY } from "@/components/work/MapDialog";
import type { WorkItemRow } from "@/lib/work-types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), remap: vi.fn(), toast: vi.fn(), close: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [{ id: "e1", code: "CF", title: "Pricing", clients: null }] }) }));
vi.mock("@/components/work/TypeIcon", () => ({ TypeIcon: () => null }));
vi.mock("@/lib/episodes.functions", () => ({ detachEpisodeItems: vi.fn(), syncEpisodeForMapping: vi.fn() }));
vi.mock("@/lib/workflow-order", () => ({ remapItems: mocks.remap }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: async () => ({ data: [{ id: "t1", name: "Research" }], error: null }) }) }) }) }),
} }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: "default-task", error: null });
  mocks.remap.mockResolvedValue({ error: null });
});

function openDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MapDialog
    item={{ id: "w1", title: "Memo", type: "document", source: "import:manual" } as WorkItemRow}
    open onOpenChange={mocks.close} entry="nav_no_board"
  /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "CF Pricing" }));
}

describe("MAP-UX optional workstreams", () => {
  it("maps to the board default home without choosing a workstream and preserves entry", async () => {
    openDialog();
    expect(screen.getByRole("heading", { name: "Put on a board" })).toBeTruthy();
    expect(screen.queryByTestId("declare-workflow")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Put on CF Pricing" }));
    await waitFor(() => expect(mocks.remap).toHaveBeenCalledWith(expect.objectContaining({ taskId: "default-task", entry: "nav_no_board" })));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_board_default_task", { p_engagement: "e1" });
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith("Added to CF · Pricing");
    expect(mocks.close).toHaveBeenCalledWith(false);
  });

  it("keeps optional workstream mapping and names it in the confirmation", async () => {
    openDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Research" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Added to CF · Pricing · Research"));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.remap).toHaveBeenCalledWith(expect.objectContaining({ taskId: "t1" }));
  });

  it("keeps the dialog open and emits no confirmation when default home resolution fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "No access" } });
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Put on CF Pricing" }));
    expect(await screen.findByText("No access")).toBeTruthy();
    expect(mocks.remap).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it("pins the requested copy without banned words or em dashes", () => {
    expect(COPY.title).toBe("Put on a board");
    expect(COPY.visibility).toBe("Your workboard team can see what you put on it.");
    expect(COPY.optional).toBe("Or put it in a workstream (optional)");
    for (const text of Object.values(COPY)) {
      expect(text).not.toMatch(/score|monitor|track|surveillance|—/i);
    }
  });
});