import { beforeEach, describe, expect, it, vi } from "vitest";

/** MCP-T1d: the client name survives a cold isolate via the connection row. Mock block copied from mcp-t3-push-intent.test.ts. */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const uploads: { path: string; opts: Record<string, unknown> }[] = [];
const events: { eventType: string; dims: Record<string, unknown> }[] = [];
let seq = 0;
let failConnections = false;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function table(name: string): Row[] {
  return (db[name] ??= []);
}

function builder(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "insert" | "update" = "select";
  let payload: Row | Row[] | null = null;
  let written: Row[] = [];
  const sorts: [string, boolean][] = [];
  const run = () => {
    if (name === "mcp_connections" && failConnections) throw new Error("connections unavailable");
    if (op === "insert") {
      const rows = (Array.isArray(payload) ? payload : [payload ?? {}]).map((r) => ({ id: newId(), ...(name === "push_intents" ? { status: "intent", created_at: new Date().toISOString() } : {}), ...r }));
      table(name).push(...rows);
      written = rows;
      return rows;
    }
    const hit = table(name).filter((r) => filters.every((f) => f(r)));
    for (const [k, asc] of sorts) hit.sort((a, b) => (k === "created_at" ? String(a[k]).localeCompare(String(b[k])) : Number(a[k]) - Number(b[k])) * (asc ? 1 : -1));
    if (op === "update") {
      for (const r of hit) Object.assign(r, payload);
      written = hit;
      return hit;
    }
    return hit;
  };
  const b: Record<string, unknown> = {
    select: () => b,
    insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), b),
    update: (p: Row) => ((op = "update"), (payload = p), b),
    eq: (k: string, v: unknown) => (filters.push((r) => !k.includes("->>") && r[k] === v), b),
    is: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    gte: (k: string, v: string) => (filters.push((r) => String(r[k]) >= v), b),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), b),
    order: (k: string, o?: { ascending?: boolean }) => (sorts.push([k, o?.ascending !== false]), b),
    limit: () => b,
    maybeSingle: async () => {
      const rows = op === "select" ? run() : (run(), written);
      return { data: rows[0] ?? null, error: null };
    },
    single: async () => {
      const rows = op === "select" ? run() : (run(), written);
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "none" } };
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(res, rej),
  };
  return b;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (name: string) => builder(name),
    rpc: async (name: string) => ({ data: name === "mcp_resolve_key" ? [{ connection_id: "c1", profile_id: "p1", org_id: "o1", user_id: "u1", kind: "link", read_only: false, legacy: false }] : null, error: null }),
    storage: { from: () => ({ upload: async (path: string, _b: unknown, opts: Record<string, unknown>) => (uploads.push({ path, opts }), { error: null }), download: async () => ({ data: null }) }) },
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
vi.mock("@/lib/connector-import.server", () => ({
  recordNewVersion: async (_c: unknown, a: { workItemId: string }) => (table("document_versions").push({ id: newId(), work_item_id: a.workItemId, version_no: 2, push_id: null }), 2),
}));
vi.mock("@/lib/org-type.server", () => ({
  isAffiliatedStrict: async () => false,
  orgTypeOfStrict: async () => "company",
}));

import { handleMcpRequest, pushConversation } from "@/lib/mcp-handler.server";

const OWNER = { tokenId: "t1", profileId: "p1", orgId: "o1", userId: "u1", kind: "link", readOnly: false, legacy: true, authKind: "link" as const };
const msgs = (...texts: string[]) => texts.map((content, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content }));
const first = ["Plan the pricing study.", "Start with three segments and a survey.", "Which segment first?"];

async function call(name: string, args: Row = {}) {
  const response = await handleMcpRequest(new Request("https://example.test/mcp", {
    method: "POST", body: JSON.stringify({ method: "tools/call", id: 2, params: { name, arguments: args } }),
  }), "key");
  return response.json();
}
async function initialize(clientName: string) {
  const response = await handleMcpRequest(new Request("https://example.test/mcp", {
    method: "POST", body: JSON.stringify({ method: "initialize", id: 1, params: { clientInfo: { name: clientName, version: "1" } } }),
  }), "key");
  return response.json();
}
/** What clientIdentity returns on a cold isolate: no initialize memory. */
const COLD = { name: "unknown", version: "unknown", protocol: "unknown" };
async function push(messages: unknown[], extra: Row = {}, client: Row = COLD) {
  const res = await pushConversation(OWNER, { vendor: "claude", orig_conversation_id: "conv-1", messages, ...extra }, 1, client as never);
  return (await res.json()) as { result?: { content: { text: string }[] }; error?: unknown };
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  events.length = 0;
  uploads.length = 0;
  seq = 0;
  failConnections = false;
});

describe("MCP-T1d client name", () => {
  it("stamps client_name on initialize when the connection row has none", async () => {
    table("mcp_connections").push({ id: "c1", client_name: null });
    const out = await initialize("Claude");
    expect(out.error).toBeUndefined();
    expect(table("mcp_connections")[0]?.["client_name"]).toBe("Claude");
  });
  it("leaves an existing client_name alone on initialize", async () => {
    table("mcp_connections").push({ id: "c1", client_name: "Existing" });
    await initialize("Claude");
    expect(table("mcp_connections")[0]?.["client_name"]).toBe("Existing");
  });
  it("falls back to the connection row on the push history when the isolate is cold", async () => {
    table("mcp_connections").push({ id: "t1", client_name: "Claude" });
    const pushed = await push(msgs(...first));
    expect(pushed.error).toBeUndefined();
    expect(table("work_item_pushes")[0]?.["client_name"]).toBe("Claude");
  });
  it("falls back to the connection row on the push intent when the isolate is cold", async () => {
    table("mcp_connections").push({ id: "c1", client_name: "Claude" });
    const out = await call("lasso_push_options", { title: "Pricing study", vendor: "claude", orig_conversation_id: "conv-1" });
    expect(out.error).toBeUndefined();
    expect(table("push_intents")[0]?.["client_name"]).toBe("Claude");
  });
  it("prefers the initialize memory over the connection row", async () => {
    table("mcp_connections").push({ id: "c1", client_name: "Claude" });
    await initialize("Claude Desktop");
    const out = await call("lasso_push_options", { title: "Pricing study", vendor: "claude", orig_conversation_id: "conv-1" });
    expect(out.error).toBeUndefined();
    expect(table("push_intents")[0]?.["client_name"]).toBe("Claude Desktop");
  });
  it("never blocks a push when the connection read fails", async () => {
    failConnections = true;
    const pushed = await push(msgs(...first));
    expect(pushed.error).toBeUndefined();
    expect(table("work_item_pushes")[0]?.["client_name"]).toBeNull();
  });
});
