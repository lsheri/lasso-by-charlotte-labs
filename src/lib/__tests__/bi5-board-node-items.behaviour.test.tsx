// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inSpy = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        in: (column: string, ids: string[]) => {
          inSpy(table, columns, column, ids);
          return Promise.resolve({ data: ids.map((id) => ({ id, owner_id: "teammate", title: `Item ${id}`, type: "ai_thread", meta: null })), error: null });
        },
      }),
    }),
  },
}));

const { useBoardNodeItems } = await import("@/hooks/use-board-node-items");

const placed = [{ id: "mine", owner_id: "me", title: "Mine", type: "ai_thread", work_item_tasks: [] }] as never[];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function find(items: { id: string }[], id: string | undefined) {
  return id ? items.find((item) => item.id === id) : undefined;
}

describe("BI-5 board node items", () => {
  beforeEach(() => inSpy.mockClear());
  afterEach(cleanup);

  it("resolves a placed item as before and issues no by-id read", async () => {
    const { result } = renderHook(() => useBoardNodeItems([{ workItemId: "mine" }], placed), { wrapper });
    expect(find(result.current.items, "mine")).toBe(placed[0]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(inSpy).not.toHaveBeenCalled();
  });

  it("resolves an item missing from the placement list through one by-id read", async () => {
    const nodes = [{ workItemId: "mine" }, { workItemId: "theirs" }, { workItemId: "theirs" }, { workItemId: "other" }];
    const { result } = renderHook(() => useBoardNodeItems(nodes, placed), { wrapper });
    expect(result.current.pendingIds.has("theirs")).toBe(true);
    await waitFor(() => expect(find(result.current.items, "theirs")).toBeTruthy());
    expect(find(result.current.items, "theirs")).toMatchObject({ owner_id: "teammate", work_item_tasks: [] });
    expect(find(result.current.items, "other")).toBeTruthy();
    expect(inSpy).toHaveBeenCalledTimes(1);
    expect(inSpy.mock.calls[0]?.[0]).toBe("work_items");
    expect(inSpy.mock.calls[0]?.[1]).toContain("work_item_extracts(summary)");
    expect(inSpy.mock.calls[0]?.[3]).toEqual(["other", "theirs"]);
    expect(result.current.pendingIds.size).toBe(0);
  });

  it("resolves a node with no work item to nothing and asks for nothing", async () => {
    const { result } = renderHook(() => useBoardNodeItems([{ workItemId: null }, {}], placed), { wrapper });
    expect(find(result.current.items, undefined)).toBeUndefined();
    expect(result.current.items).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(inSpy).not.toHaveBeenCalled();
  });
});
