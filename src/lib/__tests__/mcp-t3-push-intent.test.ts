import { beforeEach, describe, expect, it, vi } from "vitest";

/** PUSH-1: the record keeps its own push history. Mock block copied from r1-file-ref-rendition.test.ts. */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const uploads: { path: string; opts: Record<string, unknown> }[] = [];
const events: { eventType: string; dims: Record<string, unknown> }[] = [];
let seq = 0;
let failPushHistory = false;
let failIntent = false;
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
    if (name === "push_intents" && failIntent) throw new Error("intent unavailable");
    if (op === "insert" && name === "work_item_pushes" && failPushHistory) throw new Error("push history down");
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

import { handleMcpRequest, pushConversation, parseIncomingAttachment, parseMessageFidelity, intentStatus, LASSO_CONNECTOR_VERSION } from "@/lib/mcp-handler.server";

const OWNER = { tokenId: "t1", profileId: "p1", orgId: "o1", userId: "u1", kind: "link", readOnly: false, legacy: true, authKind: "link" as const };
const CLIENT = { name: "Claude Desktop", version: "1", protocol: "2025-06-18" };
const msgs = (...texts: string[]) => texts.map((content, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content }));
const first = ["Plan the pricing study.", "Start with three segments and a survey.", "Which segment first?"];
async function push(messages: unknown[], extra: Record<string, unknown> = {}) {
  const res = await pushConversation(OWNER, { vendor: "claude", orig_conversation_id: "conv-1", messages, ...extra }, 1, CLIENT);
  return (await res.json()) as { result?: { content: { text: string }[] }; error?: unknown };
}
const pushes = () => [...table("work_item_pushes")].sort((a, b) => Number(a["push_no"]) - Number(b["push_no"]));
const stamped = (pushId: unknown) => table("turns").filter((t) => t["push_id"] === pushId).map((t) => t["turn_no"]).sort();

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  events.length = 0;
  uploads.length = 0;
  seq = 0;
  failPushHistory = false;
  failIntent = false;
});


import { ATTACHMENT_KINDS } from "@/lib/conversation-shared";
const ref = (filename: string, rendition?: unknown) => ({ kind: "file_ref", title: filename, source_artifact_id: filename,
  file_ref: { filename, ...(rendition === undefined ? {} : { rendition }) } });

async function call(name: string, args: Row = {}) {
  const response = await handleMcpRequest(new Request("https://example.test/mcp", {
    method: "POST", body: JSON.stringify({ method: "tools/call", id: 2, params: { name, arguments: args } }),
  }), "key");
  return response.json();
}
async function conversationId() {
  await push(msgs(...first));
  const row = table("work_items").find((r) => r["type"] === "ai_thread");
  if (!row || typeof row["id"] !== "string") throw new Error("conversation not created");
  return row["id"];
}
const attachment = { kind: "artifact_code", title: "pricing.py", source_artifact_id: "pricing.py", content: "def price(segment):\n    return segment * 3" };


import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
const declare = (extra: Row = {}) => call("lasso_push_options", { title: "Pricing study", vendor: "claude", orig_conversation_id: "conv-1", expected_messages: 3, expected_attachments: 0, ...extra });
const outcome = (value: "new" | "rejected" | "failed") => ({ title: "file", source_artifact_id: "file", chars: 0, outcome: value });

describe("MCP-T3 push intent", () => {
  it("serves expected counts and intent ids on the specified tools", async () => {
    const response = await handleMcpRequest(new Request("https://example.test/mcp", { method: "POST", body: JSON.stringify({ method: "tools/list", id: 1 }) }), "key");
    const out = await response.json();
    const tools = out.result.tools;
    const options = tools.find((t: Row) => t["name"] === "lasso_push_options");
    expect(options.inputSchema.properties.expected_messages.type).toBe("integer");
    expect(options.inputSchema.properties.expected_attachments.type).toBe("integer");
    for (const name of ["push_conversation", "push_thread", "push_attachment"]) {
      expect(tools.find((t: Row) => t["name"] === name).inputSchema.properties.push_intent_id).toEqual({ type: "string", description: "The push_intent_id lasso_push_options returned, so Lasso can mark this push as arrived." });
    }
  });
  it("declares an intent with sourced fields and returns its id", async () => {
    await handleMcpRequest(new Request("https://example.test/mcp", { method: "POST", body: JSON.stringify({ method: "initialize", params: { clientInfo: { name: "Claude Desktop", version: "1" } } }) }), "key");
    const out = await declare();
    const id = out.result.structuredContent.push_intent_id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.result.content[0].text).toContain(`push_intent_id: ${id}`);
    expect(table("push_intents")[0]).toMatchObject({ id, status: "intent", profile_id: "p1", org_id: "o1", title: "Pricing study", vendor: "claude", orig_conversation_id: "conv-1", tool: "push_conversation", client_name: "Claude Desktop", expected_messages: 3, expected_attachments: 0 });
    expect(events.find((e) => e.eventType === "mcp.push_intent_declared")?.dims).toEqual({ tool: "push_conversation", vendor: "claude", has_expected: "true", connector_version: LASSO_CONNECTOR_VERSION });
  });
  it("completes the explicitly named intent with the push and item ids", async () => {
    const out = await declare();
    await push(msgs(...first), { push_intent_id: out.result.structuredContent.push_intent_id });
    const intent = table("push_intents")[0];
    expect(intent).toMatchObject({ status: "complete", push_id: table("work_item_pushes")[0]?.["id"], work_item_id: table("work_items")[0]?.["id"] });
    expect(intent?.["completed_at"]).toEqual(expect.any(String));
    expect(events.find((e) => e.eventType === "mcp.push_intent_completed")?.dims).toEqual({ tool: "push_conversation", status: "complete", matched_by: "id", connector_version: LASSO_CONNECTOR_VERSION });
  });
  it("marks an intent partial when an attachment is rejected", async () => {
    const out = await declare({ expected_attachments: 1 });
    await push(msgs(...first), { push_intent_id: out.result.structuredContent.push_intent_id, attachments: [ref("notes.docx")] });
    expect(table("push_intents")[0]?.["status"]).toBe("partial");
  });
  it("uses only the newest same-owner, same-org intent within 24 hours for fallback", async () => {
    table("push_intents").push(
      { id: newId(), profile_id: "p1", org_id: "o1", orig_conversation_id: "conv-1", status: "intent", created_at: new Date(Date.now() - 25 * 3600000).toISOString() },
      { id: newId(), profile_id: "p1", org_id: "o1", orig_conversation_id: "conv-1", status: "intent", created_at: new Date(Date.now() - 2000).toISOString() },
      { id: newId(), profile_id: "p1", org_id: "o1", orig_conversation_id: "conv-1", status: "intent", created_at: new Date(Date.now() - 1000).toISOString() },
      { id: newId(), profile_id: "other", org_id: "o1", orig_conversation_id: "conv-1", status: "intent", created_at: new Date().toISOString() },
      { id: newId(), profile_id: "p1", org_id: "other", orig_conversation_id: "conv-1", status: "intent", created_at: new Date().toISOString() },
    );
    await push(msgs(...first));
    expect(table("push_intents").map((r) => r["status"])).toEqual(["intent", "intent", "complete", "intent", "intent"]);
    expect(events.find((e) => e.eventType === "mcp.push_intent_completed")?.dims["matched_by"]).toBe("fallback");
  });
  it("never falls back from a supplied unowned intent id", async () => {
    const out = await declare();
    await push(msgs(...first), { push_intent_id: "00000000-0000-4000-8000-999999999999" });
    expect(table("push_intents")[0]?.["status"]).toBe("intent");
    expect(events.find((e) => e.eventType === "mcp.push_intent_completed")?.dims["matched_by"]).toBe("none");
    expect(out.result.structuredContent.push_intent_id).toBeTruthy();
  });
  it("passes intent ids through the attachment entry", async () => {
    const id = await conversationId();
    const out = await declare({ expected_attachments: 1 });
    await call("push_attachment", { lasso_conversation_id: id, attachment, push_intent_id: out.result.structuredContent.push_intent_id });
    expect(table("push_intents")[0]).toMatchObject({ status: "complete", work_item_id: id });
    expect(events.filter((e) => e.eventType === "mcp.push_intent_completed").at(-1)?.dims).toMatchObject({ tool: "push_attachment", matched_by: "id" });
  });
  it("completes intents for push_thread", async () => {
    const out = await declare();
    await call("push_thread", { title: "Transcript", source_ai: "claude", turns: msgs(...first), push_intent_id: out.result.structuredContent.push_intent_id });
    expect(table("push_intents")[0]?.["status"]).toBe("complete");
    expect(table("push_intents")[0]?.["push_id"]).toBe(table("work_item_pushes")[0]?.["id"]);
  });
  it("revisits a partial intent when the same push's later window arrives by id", async () => {
    const out = await declare({ expected_messages: 4 });
    const intentId = out.result.structuredContent.push_intent_id;
    await push(msgs("One.", "Two."), { window: { from: 1, to: 2, total: 4 }, push_intent_id: intentId });
    expect(table("push_intents")[0]?.["status"]).toBe("partial");
    await push(msgs("Three.", "Four."), { window: { from: 3, to: 4, total: 4 }, push_intent_id: intentId });
    expect(table("push_intents")[0]?.["status"]).toBe("complete");
    expect(events.filter((e) => e.eventType === "mcp.push_intent_completed").map((e) => e.dims["status"])).toEqual(["partial", "complete"]);
  });
  it("revisits a partial intent through the fallback when the later window arrives", async () => {
    await declare({ expected_messages: 4 });
    await push(msgs("One.", "Two."), { window: { from: 1, to: 2, total: 4 } });
    expect(table("push_intents")[0]?.["status"]).toBe("partial");
    await push(msgs("Three.", "Four."), { window: { from: 3, to: 4, total: 4 } });
    expect(table("push_intents")[0]?.["status"]).toBe("complete");
    expect(events.filter((e) => e.eventType === "mcp.push_intent_completed").map((e) => e.dims["matched_by"])).toEqual(["fallback", "fallback"]);
  });
  it("never touches another profile's partial intent", async () => {
    table("push_intents").push({ id: newId(), profile_id: "other", org_id: "o1", orig_conversation_id: "conv-1", status: "partial", created_at: new Date().toISOString() });
    await push(msgs(...first));
    expect(table("push_intents")[0]?.["status"]).toBe("partial");
    expect(table("push_intents")[0]).not.toHaveProperty("push_id");
    expect(events.find((e) => e.eventType === "mcp.push_intent_completed")?.dims["matched_by"]).toBe("none");
  });
  it("does not fail options or pushes when intent storage throws", async () => {
    failIntent = true;
    const out = await declare();
    expect(out.error).toBeUndefined();
    expect(out.result.structuredContent.push_intent_id).toBeNull();
    const pushed = await push(msgs(...first));
    expect(pushed.error).toBeUndefined();
  });
  it("classifies good outcomes as complete", () => expect(intentStatus([outcome("new")], null, 10)).toBe("complete"));
  it("classifies rejected outcomes as partial", () => expect(intentStatus([outcome("rejected")], null, 10)).toBe("partial"));
  it("classifies failed outcomes as partial", () => expect(intentStatus([outcome("failed")], null, 10)).toBe("partial"));
  it("classifies 10 stored of 30 as partial", () => expect(intentStatus([], 30, 10)).toBe("partial"));
  it("registers the two exact content-free dimension lists", () => {
    expect(EVENT_DIM_KEYS["mcp.push_intent_declared"]).toEqual(["connector_version", "has_expected", "tool", "vendor"]);
    expect(EVENT_DIM_KEYS["mcp.push_intent_completed"]).toEqual(["connector_version", "matched_by", "status", "tool"]);
  });
});
