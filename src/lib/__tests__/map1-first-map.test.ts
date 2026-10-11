// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));

const h = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  supa: { from: vi.fn() },
  profileResolve: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: h.supa }));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: h.recordEvent }));
vi.mock("@/lib/profile-resolve", () => ({ resolveProfile: h.profileResolve }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/mapping.functions", () => ({ suggestMappings: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      inputValidator: (v: unknown) => ({ handler: (fn: unknown) => ({ __handler: fn, __validator: v }) }),
    }),
  }),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: {} }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { remapItems } from "@/lib/workflow-order";

function fakeClient(existing: string[]) {
  const ok = { error: null };
  return {
    from: () => ({
      select: () => ({ in: async () => ({ data: existing.map((id) => ({ work_item_id: id })), error: null }) }),
      delete: () => ({ in: async () => ok }),
      insert: async () => ok,
      update: () => ({ in: async () => ok }),
    }),
  } as never;
}

async function run(existing: string[], entry?: "nav_no_board") {
  return remapItems({
    client: fakeClient(existing),
    targets: [
      { id: "a", type: "document", source: "upload" },
      { id: "b", type: "thread", source: "claude" },
    ],
    taskId: "t1",
    profile: { id: "p1", org_id: "o1" },
    detachEpisode: async () => null,
    syncEpisode: async () => null,
    invalidate: () => undefined,
    entry,
  });
}

describe("MAP-1 remapItems", () => {
  beforeEach(() => logEvent.mockReset());

  it("emits only for targets with no prior placement, with via list", async () => {
    await run(["a"]);
    const mapped = logEvent.mock.calls.filter((c) => c[0] === "workitem.mapped");
    expect(mapped).toEqual([["workitem.mapped", "o1", { type: "thread", source: "claude", via: "list" }]]);
  });

  it("emits nothing when every target was already mapped", async () => {
    await run(["a", "b"]);
    expect(logEvent.mock.calls.filter((c) => c[0] === "workitem.mapped")).toEqual([]);
  });

  it("keeps the NAV-5 entry dim", async () => {
    await run([], "nav_no_board");
    const mapped = logEvent.mock.calls.filter((c) => c[0] === "workitem.mapped");
    expect(mapped).toHaveLength(2);
    expect(mapped[0]![2]).toEqual({ type: "document", source: "upload", via: "list", entry: "nav_no_board" });
  });
});

describe("MAP-1 board and MCP callers", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const fn = readFileSync("src/lib/workstream-draw.functions.ts", "utf8");
  const mcp = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

  it("board emits only when first_map is true", () => {
    expect(fn).toContain("first_map: payload.first_map === true");
    expect(page).toContain("if (result.first_map === true) {");
    expect(page).toContain("if (orgId && item) noteBoardFirstMap(orgId, item);");
    expect(page).toContain('logEvent("workitem.mapped", orgId, { type: item.type, source: item.source, via: "board" });');
  });

  it("MCP records through recordEvent only when first_map is true", () => {
    expect(mcp).toContain("if (result.first_map === true) await recordFirstMap(owner, itemId, tool);");
    expect(mcp).toContain('eventType: "workitem.mapped"');
    expect(mcp).toContain('via: "mcp", tool }');
    expect(mcp).not.toMatch(/from\("events"\)\s*\.insert/);
  });
});

describe("MAP-2 placeWorkOnBoardFn", () => {
  // The TanStack Start vite plugin rewrites server-function handlers into SSR
  // rpc stubs under vitest, so a behavioural call is not possible here. These
  // assertions pin the source instead, the same pattern as the MAP-1 guards.
  const fn = readFileSync("src/lib/workboard-add-work.functions.ts", "utf8");

  it("reads prior placement anywhere before the insert", () => {
    const prior = fn.indexOf('const prior = await supabase\n      .from("work_item_tasks")');
    const insert = fn.indexOf('.insert(toPlace.map((id) => ({ work_item_id: id, task_id: taskId })))');
    expect(prior).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(prior).toBeLessThan(insert);
    expect(fn).toContain("const alreadyMapped = new Set(");
  });

  it("emits through recordEvent only for first placements, with via add_work", () => {
    expect(fn).toContain('await import("@/lib/telemetry.server")');
    expect(fn).toContain("if (!toPlace.includes(item.id) || alreadyMapped.has(item.id)) continue;");
    expect(fn).toContain('eventType: "workitem.mapped"');
    expect(fn).toContain('dims: { type: item.type, source: item.source, via: "add_work" }');
    expect(fn).toContain("orgId: profile.org_id");
    expect(fn).toContain("profileId: profile.id");
    expect(fn).not.toMatch(/from\("events"\)\s*\.insert/);
  });
});

describe("MAP-2 suggestion accept", () => {
  beforeEach(() => logEvent.mockReset());

  function acceptClient(priorCount: number) {
    const ok = { error: null };
    return {
      from: (table: string) =>
        table === "work_items"
          ? { update: () => ({ eq: async () => ok }) }
          : {
              select: () => ({
                eq: async () => ({
                  data: Array.from({ length: priorCount }, () => ({ work_item_id: "w1" })),
                  error: null,
                }),
              }),
              delete: () => ({ eq: async () => ok }),
              insert: async () => ok,
            },
    };
  }

  async function accept(priorCount: number) {
    h.supa.from = acceptClient(priorCount).from as never;
    const { renderHook, act } = await import("@testing-library/react");
    const { useMappingSuggestions } = await import("@/hooks/use-mapping-suggestions");
    const { result } = renderHook(() => useMappingSuggestions());
    await act(async () => {
      await result.current.accept(
        { work_item_id: "w1", task_id: "t1" } as never,
        { type: "thread", source: "claude" },
      );
    });
  }

  it("emits with via suggestion when the item had no prior placement", async () => {
    await accept(0);
    const mapped = logEvent.mock.calls.filter((c) => c[0] === "workitem.mapped");
    expect(mapped).toEqual([
      ["workitem.mapped", "o1", { type: "thread", source: "claude", suggested: true, via: "suggestion" }],
    ]);
  });

  it("emits nothing when the item was already placed somewhere", async () => {
    await accept(1);
    expect(logEvent.mock.calls.filter((c) => c[0] === "workitem.mapped")).toEqual([]);
  });
});
