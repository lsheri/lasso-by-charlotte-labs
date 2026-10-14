// @vitest-environment jsdom
/** WS-2: All work reads only the active workspace, and reads nothing without one. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    eqCalls: [] as { table: string; args: unknown[] }[],
    fromCalls: 0,
    profile: null as null | { id: string; org_id: string },
  };
  function builder(table: string) {
    const b: any = {
      select: () => b,
      order: () => b,
      in: () => b,
      eq: (...args: unknown[]) => {
        state.eqCalls.push({ table, args });
        return b;
      },
      then: (ok?: (v: unknown) => unknown, bad?: (r: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(ok, bad),
    };
    return b;
  }
  const supabase = {
    from: (table: string) => {
      state.fromCalls += 1;
      return builder(table);
    },
  };
  return { state, supabase };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: h.supabase }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: h.state.profile }) }));

const { fetchWorkItems, useWorkItems } = await import("@/hooks/use-work-items");

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  h.state.eqCalls = [];
  h.state.fromCalls = 0;
  h.state.profile = null;
});

describe("WS-2 All work is one workspace", () => {
  it("filters the work_items read by the org id it is given", async () => {
    await fetchWorkItems("org-a");
    expect(h.state.eqCalls).toEqual([{ table: "work_items", args: ["org_id", "org-a"] }]);
  });

  it("keys the cache by workspace so two workspaces never share an entry", () => {
    const client = new QueryClient();
    h.state.profile = { id: "p-a", org_id: "org-a" };
    renderHook(() => useWorkItems(), { wrapper: wrap(client) });
    h.state.profile = { id: "p-b", org_id: "org-b" };
    renderHook(() => useWorkItems(), { wrapper: wrap(client) });
    const keys = client.getQueryCache().getAll().map((q) => q.queryKey);
    expect(keys).toContainEqual(["work-items", "org-a"]);
    expect(keys).toContainEqual(["work-items", "org-b"]);
  });

  it("reads nothing at all when there is no active profile", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useWorkItems(), { wrapper: wrap(client) });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(h.state.fromCalls).toBe(0);
  });

  const source = readFileSync(resolve(process.cwd(), "src/hooks/use-work-items.ts"), "utf8");

  it("has no work_items select without an org_id constraint", () => {
    const reads = source.split('.from("work_items")').slice(1);
    expect(reads.length).toBeGreaterThan(0);
    for (const tail of reads) {
      const statement = tail.slice(0, tail.indexOf(";"));
      expect(statement).toContain('.eq("org_id", orgId)');
    }
  });

  it("does not name the non-existent wit_owner_all policy", () => {
    expect(source).not.toContain("wit_owner_all");
  });
});
