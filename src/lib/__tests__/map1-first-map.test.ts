import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

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
