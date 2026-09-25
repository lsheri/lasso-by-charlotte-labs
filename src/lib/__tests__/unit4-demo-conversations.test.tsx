import { readFileSync } from "node:fs";

import { describe, expect, it, vi, beforeEach } from "vitest";

import { EVENT_DIM_KEYS, guardEventDims } from "../event-dim-allowlist";
import { publicSafeWork } from "../public-work-allowlist";

const sent: unknown[] = [];
vi.mock("../telemetry.functions", () => ({
  recordAnonymousEventFn: (arg: unknown) => {
    sent.push(arg);
    return Promise.resolve({ ok: true });
  },
}));

describe("unit 4 demo conversations and sources", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("the conversations payload carries no urls, refs or real ids", () => {
    const [safe] = publicSafeWork([
      {
        id: "w1",
        type: "ai_thread",
        title: "Q3 margin",
        url: "https://claude.ai/chat/abc",
        content_ref: "storage/key",
        orig_conversation_id: "conv-real",
        source_meta: { vendor: "claude", drive_file_id: "d1", url: "https://x" },
        meta: { owner_profile_id: "p1" },
        owner_id: "u-real",
        client_id: "c-real",
        taskIds: ["t-real"],
      } as never,
    ]);
    const json = JSON.stringify({ ...safe!, placedIn: [] });
    expect(json).not.toMatch(/https?:|storage\/key|conv-real|drive_file_id|owner_profile_id|u-real|c-real|t-real/);
  });

  it("the server path reaches only the one is_demo org", () => {
    const src = readFileSync("src/lib/demo-board.server.ts", "utf8");
    const fn = src.slice(src.indexOf("export async function openDemoConversations"));
    expect(fn).toContain("demoOrgId(supabaseAdmin)");
    expect(fn).toContain('.eq("org_id", orgId)');
    expect(fn).toContain("demoBoard(");
    expect(src).toContain('.eq("is_demo", true)');
    expect(readFileSync("src/lib/demo.functions.ts", "utf8")).toMatch(/openDemoConversationsFn = createServerFn\(\{ method: "POST" \}\)\.handler/);
  });

  it("renders no write controls and never the MCP link", () => {
    const page = readFileSync("src/pages/DemoExtraPages.tsx", "utf8");
    for (const word of ["Push", "Capture", "Map to", "Comment", "Share", "Delete", "createMcpToken", "getMcpToken", "/api/mcp"]) {
      expect(page).not.toContain(word);
    }
    expect(page).toContain("readOnly");
    expect(page).toContain("Your link is issued when your pilot starts.");
    const steps = readFileSync("src/lib/mcp-setup-steps.ts", "utf8");
    expect(steps).not.toMatch(/\/api\/mcp/);
  });

  it("both routes are noindex and phone safe", () => {
    for (const r of ["conversations", "sources"]) {
      const route = readFileSync(`src/routes/demo.${r}.tsx`, "utf8");
      expect(route).toContain("noindex, nofollow");
    }
    expect(readFileSync("src/pages/DemoExtraPages.tsx", "utf8")).toContain("overflow-x-hidden");
  });

  it("events fire with allowlisted dims only", async () => {
    const t = await import("../demo-telemetry");
    t.resetDemoTelemetry();
    t.noteDemoOpened("conversations", "none");
    t.noteDemoOpened("sources", "none");
    t.noteDemoFilterChanged("gemini");
    t.noteDemoFilterChanged("../secret");
    t.noteDemoCardOpened("YSM-01", "ai_thread");
    const events = sent.map((s) => (s as { data: { event_type: string; dims: Record<string, unknown> } }).data);
    expect(events.map((e) => e.event_type)).toEqual(["demo.opened", "demo.opened", "demo.filter_changed", "demo.filter_changed", "demo.card_opened"]);
    expect(events[2]!.dims).toEqual({ tool: "gemini" });
    expect(events[3]!.dims).toEqual({ tool: "other" });
    expect(EVENT_DIM_KEYS["demo.filter_changed"]).toEqual(["tool"]);
    expect(guardEventDims("demo.filter_changed", { tool: "claude", title: "x" }).dims).toEqual({ tool: "claude" });
  });
});
