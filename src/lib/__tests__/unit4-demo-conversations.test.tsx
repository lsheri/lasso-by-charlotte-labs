// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { EVENT_DIM_KEYS, guardEventDims } from "../event-dim-allowlist";
import { publicSafeWork } from "../public-work-allowlist";

const sent: unknown[] = [];
vi.mock("../telemetry.functions", () => ({
  recordAnonymousEventFn: (arg: unknown) => {
    sent.push(arg);
    return Promise.resolve({ ok: true });
  },
}));

// ConnectYourAiCard pulls in the connector queries, the profile hook and the
// event path. None of that is what this guard is about, and none of it can run
// in a test without a real workspace, so it is stubbed the same way the
// connector setup test stubs it.
vi.mock("@/lib/telemetry", () => ({ logEvent: () => undefined }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: null }) }));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/mcp-connections.functions", () => ({
  CONNECTION_LIMIT_ERROR: "connection_limit",
  listConnections: () => Promise.resolve([]),
  createConnection: () => Promise.resolve({ id: "c2", kind: "link", secret: "raw" }),
  revealConnection: () => Promise.resolve({ secret: "raw" }),
  renameConnection: () => Promise.resolve({ ok: true }),
  revokeConnection: () => Promise.resolve({ ok: true }),
}));

const { SetupSteps } = await import("@/components/connectors/ConnectYourAiCard");

describe("unit 4 demo conversations and sources", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  afterEach(() => cleanup());

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
    for (const word of ["Push", "Capture", "Map to", "Comment", "Share", "Delete", "createConnection", "listConnections", "/api/mcp"]) {
      expect(page).not.toContain(word);
    }
    expect(page).toContain("readOnly");
    expect(page).toContain("Your link is issued when your pilot starts.");
    // The assertion this replaces scanned mcp-setup-steps.ts for the MCP link.
    // That scan was a proxy: the demo page could only ever show an MCP endpoint
    // by way of the steps file, so reading the file stood in for reading the
    // page. The page now passes showSignin={false}, which keeps the sign-in
    // group, and its URL, out of the rendered block directly. So the file scan
    // now bans a literal that can no longer reach the page. What follows
    // asserts the real thing, at render time, which is the stronger guard.
    // The second render is the positive control: without it, the first
    // assertion would also pass if SetupSteps rendered nothing at all.
    const demoBlock = render(<SetupSteps showSignin={false} />);
    expect(demoBlock.container.textContent).not.toContain("/api/mcp");
    const settingsBlock = render(<SetupSteps />);
    expect(settingsBlock.container.textContent).toContain("/api/mcp");
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
