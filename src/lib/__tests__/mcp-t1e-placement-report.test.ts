import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MCP-T1e: a destination-free push on an already-placed conversation reports
 * where it sits, and push_attachment names the stored title.
 * Mock block combines pf1-inherited-placement and mcp-t2-one-object-per-call.
 */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const events: { eventType: string; dims: Record<string, unknown> }[] = [];
const rpcCalls: { name: string; args: Row }[] = [];
let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const table = (name: string): Row[] => (db[name] ??= []);

function builder(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "insert" | "update" = "select";
  let payload: Row | Row[] | null = null;
  let written: Row[] = [];
  const run = () => {
    if (op === "insert") {
      const rows = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({ id: newId(), ...r }));
      table(name).push(...rows);
      written = rows;
      return rows;
    }
    const hit = table(name).filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      for (const r of hit) Object.assign(r, payload);
      written = hit;
    }
    return hit;
  };
  const b: Record<string, unknown> = {
    select: () => b,
    insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), b),
    update: (p: Row) => ((op = "update"), (payload = p), b),
    eq: (k: string, v: unknown) => (filters.push((r) => !k.includes("->>") && r[k] === v), b),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), b),
    order: () => b,
    limit: () => b,
    maybeSingle: async () => ({ data: (op === "select" ? run() : (run(), written))[0] ?? null, error: null }),
    single: async () => {
      const rows = op === "select" ? run() : (run(), written);
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "none" } };
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(res, rej),
  };
  return b;
}

const refOfTask = (taskId: unknown) => (taskId === "t1" ? "CFT-01 · General" : "NWG-02 · Research");

/** Stands in for mcp_place_item: never moves when p_move is false. */
async function placeItem(args: Row) {
  const maps = table("work_item_tasks");
  const mine = maps.filter((m) => m["work_item_id"] === args["p_work_item"]);
  if (mine.some((m) => m["task_id"] === args["p_task"])) return { status: "already_here", ref: refOfTask(args["p_task"]) };
  if (mine.length > 0 && !args["p_move"]) {
    return { status: "on_other", placements: mine.map((m) => ({ ref: refOfTask(m["task_id"]) })) };
  }
  maps.push({ work_item_id: args["p_work_item"], task_id: args["p_task"] });
  return { status: "placed", ref: refOfTask(args["p_task"]) };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (name: string) => builder(name),
    rpc: async (name: string, args: Row) => {
      if (name === "mcp_resolve_key") {
        return { data: [{ connection_id: "c1", profile_id: "p1", org_id: "o1", user_id: "u1", kind: "link", read_only: false, legacy: false }], error: null };
      }
      rpcCalls.push({ name, args });
      return { data: await placeItem(args), error: null };
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), download: async () => ({ data: null }) }) },
  },
}));
vi.mock("@/lib/telemetry.server", () => ({
  recordEvent: async (_c: unknown, e: { eventType: string; dims: Record<string, unknown> }) => {
    events.push(e);
  },
  recordAnonymousEvent: async () => {},
  resolveConsentStamp: async () => ({ tier: "t2", ledgerVersion: 3 }),
}));
vi.mock("@/lib/extract.server", () => ({ ensureExtracts: async () => {} }));
vi.mock("../extract.server", () => ({ ensureExtracts: async () => {} }));
vi.mock("../chain-links.server", () => ({ recordSameConversationChain: async () => {} }));
vi.mock("../telemetry-v2.server", () => ({ recordEventV2: async () => {} }));
vi.mock("../capture-census.server", () => ({ noteCaptureContext: async () => {} }));
vi.mock("@/lib/work-taxonomy.server", () => ({ noteModelUsed: async () => {}, noteThreadShape: async () => {} }));
vi.mock("@/lib/connector-import.server", () => ({ recordNewVersion: async () => 2 }));
vi.mock("@/lib/org-type.server", () => ({ isAffiliatedStrict: async () => false, orgTypeOfStrict: async () => "company" }));

import { handleMcpRequest, pushConversation } from "@/lib/mcp-handler.server";

const OWNER = { tokenId: "t1", profileId: "p1", orgId: "o1", userId: "u1", kind: "link", readOnly: false, legacy: true, authKind: "link" as const };
type Out = { result: { content: { text: string }[]; structuredContent: Record<string, unknown> } };
const push = async (args: Row) => (await (await pushConversation(OWNER, args, 1)).json()) as Out;
const call = async (name: string, args: Row = {}) =>
  (await (await handleMcpRequest(new Request("https://example.test/mcp", {
    method: "POST", body: JSON.stringify({ method: "tools/call", id: 2, params: { name, arguments: args } }),
  }), "key")).json()) as Out;

const MSGS = [
  { role: "user", content: "Please draft the plan." },
  { role: "assistant", content: "Here is the plan as an artifact." },
];
const ATT = { kind: "artifact_code", title: "pricing.py", source_artifact_id: "pricing.py", content: "def price(segment):\n    return segment * 3" };
const thread = () => table("work_items").find((r) => r["type"] === "ai_thread")!;

/** Window 1 of two, optionally placed on a board afterwards. */
async function firstWindow(placeOn: string[], extra: Row = {}) {
  await push({ vendor: "claude", orig_conversation_id: "c1", messages: MSGS.slice(0, 1), window: { from: 1, total: 2 }, ...extra });
  for (const task of placeOn) table("work_item_tasks").push({ work_item_id: thread()["id"], task_id: task });
  events.length = 0;
  rpcCalls.length = 0;
}
const secondWindow = () =>
  push({ vendor: "claude", orig_conversation_id: "c1", messages: MSGS.slice(1), window: { from: 2, total: 2 } });

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  events.length = 0;
  rpcCalls.length = 0;
  seq = 0;
  table("engagement_members").push({ engagement_id: "e1", profile_id: "p1", member_role: "owner" }, { engagement_id: "e2", profile_id: "p1", member_role: "owner" });
  table("engagements").push(
    { id: "e1", code: "CFT-01", title: "Cure First", client_label: null, clients: null },
    { id: "e2", code: "NWG-02", title: "Northwind", client_label: null, clients: null },
  );
  table("tasks").push({ id: "t1", engagement_id: "e1", name: "General" }, { id: "t2", engagement_id: "e2", name: "Research" });
});

describe("MCP-T1e placement report", () => {
  it("window 2 on a placed conversation reports the board, never inbox or private", async () => {
    await firstWindow(["t1"]);
    const out = await secondWindow();
    const sc = out.result.structuredContent;
    expect(sc["placement"]).toEqual({ target: "workboard", ref: "CFT-01 · General", status: "already_there", note: "" });
    expect(out.result.content[0]!.text).not.toContain("stays private");
    expect((sc["notes"] as string[]).join(" ")).not.toContain("stays private");
    // The conversation itself is never placed or moved by this call.
    expect(rpcCalls.filter((c) => c.args["p_work_item"] === thread()["id"])).toHaveLength(0);
  });

  it("push_attachment on a placed conversation reports the board and names the stored title", async () => {
    await firstWindow(["t1"], { title: "Pricing study chat" });
    const out = await call("push_attachment", { lasso_conversation_id: thread()["id"], attachment: ATT });
    const sc = out.result.structuredContent;
    expect(sc["placement"]).toEqual({ target: "workboard", ref: "CFT-01 · General", status: "already_there", note: "" });
    expect(out.result.content[0]!.text).toContain("Updated 'Pricing study chat'");
    expect(out.result.content[0]!.text).not.toContain("Untitled conversation");
    expect(out.result.content[0]!.text).not.toContain("stays private");
    // The stored title is read, never written.
    expect(thread()["title"]).toBe("Pricing study chat");
    expect(thread()).not.toHaveProperty("display_title");
  });

  it("an unmapped conversation still says it stays private", async () => {
    await firstWindow([]);
    const out = await secondWindow();
    const sc = out.result.structuredContent;
    expect(sc["placement"]).toMatchObject({ target: "inbox", ref: null });
    expect(out.result.content[0]!.text).toContain("It stays private until the user maps it.");
  });

  it("push_attachment on an unmapped conversation still says it stays private", async () => {
    await firstWindow([], { title: "Pricing study chat" });
    const out = await call("push_attachment", { lasso_conversation_id: thread()["id"], attachment: ATT });
    expect(out.result.structuredContent["placement"]).toMatchObject({ target: "inbox", ref: null });
    expect(out.result.content[0]!.text).toContain("It stays private until the user maps it.");
  });
});
