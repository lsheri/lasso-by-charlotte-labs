import { beforeEach, describe, expect, it, vi } from "vitest";

/** PUSH-1: the record keeps its own push history. Mock block copied from r1-file-ref-rendition.test.ts. */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const uploads: { path: string; opts: Record<string, unknown> }[] = [];
const events: { eventType: string; dims: Record<string, unknown> }[] = [];
let seq = 0;
let failPushHistory = false;
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
    if (op === "insert" && name === "work_item_pushes" && failPushHistory) throw new Error("push history down");
    if (op === "insert") {
      const rows = (Array.isArray(payload) ? payload : [payload ?? {}]).map((r) => ({ id: newId(), ...r }));
      table(name).push(...rows);
      written = rows;
      return rows;
    }
    const hit = table(name).filter((r) => filters.every((f) => f(r)));
    for (const [k, asc] of sorts) hit.sort((a, b) => (Number(a[k]) - Number(b[k])) * (asc ? 1 : -1));
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

import { handleMcpRequest, pushConversation, parseIncomingAttachment, parseMessageFidelity, LASSO_CONNECTOR_VERSION } from "@/lib/mcp-handler.server";

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

describe("MCP-T2 one object per call", () => {
  it("serves a single attachment tool using the conversation attachment schema", async () => {
    const response = await handleMcpRequest(new Request("https://example.test/mcp", { method: "POST", body: JSON.stringify({ method: "tools/list", id: 1 }) }), "key");
    const out = await response.json();
    const tool = out.result.tools.find((t: Row) => t["name"] === "push_attachment");
    const conversation = out.result.tools.find((t: Row) => t["name"] === "push_conversation");
    expect(tool.inputSchema.required).toEqual(["lasso_conversation_id", "attachment"]);
    expect(tool.inputSchema.properties.lasso_conversation_id.type).toBe("string");
    expect(tool.inputSchema.properties.attachment).toEqual(conversation.inputSchema.properties.attachments.items);
    expect(conversation.inputSchema.properties).not.toHaveProperty("_tool");
    expect(tool.description.endsWith(`connector: ${LASSO_CONNECTOR_VERSION}`)).toBe(true);
  });
  it("creates one attachment and its push history without changing the transcript", async () => {
    const id = await conversationId();
    const before = structuredClone(table("work_items").find((r) => r["id"] === id));
    const turns = structuredClone(table("turns"));
    const out = await call("push_attachment", { lasso_conversation_id: id, attachment });
    expect(out.error).toBeUndefined();
    expect(out.result.content[0].text).toMatch(/^Attachment added\. /);
    expect(out.result.structuredContent.attachments[0].outcome).toBe("new");
    expect(table("work_items").find((r) => r["parent_work_item_id"] === id)?.["title"]).toBe("pricing.py");
    expect(table("work_items").find((r) => r["id"] === id)).toEqual(before);
    expect(table("turns")).toEqual(turns);
    expect(table("work_item_pushes")).toContainEqual(expect.objectContaining({ work_item_id: id, tool: "push_attachment", attachments_added: 1, attachments_changed: 0 }));
    expect(events.filter((e) => e.eventType === "mcp.push").at(-1)?.dims).toMatchObject({ tool: "push_attachment", connector_version: LASSO_CONNECTOR_VERSION });
    await call("push_attachment", { lasso_conversation_id: id, attachment });
    expect(table("work_items").filter((r) => r["parent_work_item_id"] === id)).toHaveLength(1);
  });
  it("reports the document text-route rejection", async () => {
    const id = await conversationId();
    const out = await call("push_attachment", { lasso_conversation_id: id, attachment: ref("notes.docx") });
    expect(out.result.content[0].text).toContain("'notes.docx' has a text form; export it and resend");
    expect(out.result.structuredContent.attachments[0]).toMatchObject({ outcome: "rejected", reason: "text_route_available" });
  });
  it("rejects another owner's conversation without writes", async () => {
    const id = await conversationId();
    const row = table("work_items").find((r) => r["id"] === id);
    if (!row) throw new Error("missing thread");
    row["owner_id"] = "someone-else";
    const before = structuredClone(db);
    const out = await call("push_attachment", { lasso_conversation_id: id, attachment });
    expect(out.error.message).toContain("does not name a conversation of yours");
    expect(db).toEqual(before);
  });
  it("keeps the empty-messages check except the owned one-attachment case", async () => {
    expect((await push([])).error).toBeDefined();
    const out = await push([], { _tool: "push_attachment", attachments: [] });
    expect(out.error).toMatchObject({ code: -32602, message: "push_attachment takes exactly one attachment against an existing lasso_conversation_id" });
  });
  it("accepts unknown summary positions, rejects absent covers, and stores no invented positions", async () => {
    expect(parseMessageFidelity({ fidelity: "summary", covers: { unknown: true } }, 1)).toEqual({ fidelity: "summary", covers_unknown: true });
    expect(parseMessageFidelity({ fidelity: "summary" }, 1)).toHaveProperty("error");
    await push([{ role: "user", content: "Earlier work was compacted.", fidelity: "summary", covers: { unknown: true } }]);
    expect(table("turns")[0]?.["meta"]).toEqual({ fidelity: "summary", covers_unknown: true });
  });
  it("removes known cover positions when a summary is revised to unknown", async () => {
    await push([{ role: "user", content: "The earlier work was compacted.", fidelity: "summary", covers: { from: 1, to: 5 } }]);
    await push([{ role: "user", content: "The earlier work was compacted, with positions no longer known.", fidelity: "summary", covers: { unknown: true } }]);
    expect(table("turns")[0]?.["meta"]).toMatchObject({ fidelity: "summary", covers_unknown: true });
    expect(table("turns")[0]?.["meta"]).not.toHaveProperty("covers_from");
    expect(table("turns")[0]?.["meta"]).not.toHaveProperty("covers_to");
  });
  it("returns the four exact advisory limits", async () => {
    const out = await call("lasso_push_options");
    expect(out.result.structuredContent.limits).toEqual({ max_bytes_per_call: 262144, max_messages_per_window: 10, max_attachments_per_call: 1, max_attachment_chars: 40960 });
    expect(out.result.content[0].text.includes("Limits per call: 10 messages, 1 attachment, about 256 KB. Push the transcript first, then each attachment with push_attachment.")).toBe(true);
  });
});
