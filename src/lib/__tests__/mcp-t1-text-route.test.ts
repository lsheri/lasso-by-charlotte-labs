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

import { handleMcpRequest, pushConversation, parseIncomingAttachment, LASSO_CONNECTOR_VERSION } from "@/lib/mcp-handler.server";

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
describe("MCP-T1 text routes", () => {
  it("rejects notes.docx without a rendition with the exact text-route receipt", () => {
    expect(parseIncomingAttachment(ref("notes.docx"), ATTACHMENT_KINDS)).toEqual({ ok: false,
      reject: "text_route_available", title: "notes.docx",
      message: "'notes.docx' has a text form. Export it and send it as artifact_markdown, or send file_ref.rendition with its text. Nothing was created for it." });
  });
  it("allows a deck placeholder without rendition", () => {
    expect(parseIncomingAttachment(ref("deck.pptx"), ATTACHMENT_KINDS).ok).toBe(true);
  });
  it("allows notes.docx with valid extracted text", () => {
    const parsed = parseIncomingAttachment(ref("notes.docx", { method: "extracted_by_script", content: "# Notes" }), ATTACHMENT_KINDS);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.attachment.rendition?.content).toBe("# Notes");
  });
  it("rejects uppercase MD", () => {
    const parsed = parseIncomingAttachment(ref("brief.MD"), ATTACHMENT_KINDS);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reject).toBe("text_route_available");
  });
  it.each(["txt", "html", "htm"])("rejects the %s text route without rendition", (extension) => {
    const parsed = parseIncomingAttachment(ref(`brief.${extension}`), ATTACHMENT_KINDS);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reject).toBe("text_route_available");
  });
  it("reports the rejection in both receipts and keeps the other attachment", async () => {
    const response = await pushConversation(OWNER, { vendor: "claude", orig_conversation_id: "mixed",
      messages: msgs("Keep these files."), attachments: [ref("notes.docx"), ref("deck.pptx")] }, 1);
    const out = await response.json() as { result: { content: { text: string }[]; structuredContent: { attachments: { title: string; outcome: string; reason?: string }[] } } };
    expect(out.result.structuredContent.attachments).toContainEqual({ title: "notes.docx", source_artifact_id: "notes.docx", outcome: "rejected", chars: 0, reason: "text_route_available" });
    expect(out.result.structuredContent.attachments.some((a) => a.title === "deck.pptx" && a.outcome === "reference_created")).toBe(true);
    expect(out.result.content[0]?.text).toContain("1 not taken");
    expect(out.result.content[0]?.text).toContain("'notes.docx' has a text form; export it and resend");
    expect(out.result.content[0]?.text).not.toContain("All of it is already stored word for word");
    expect(out.result.content[0]?.text.endsWith(`connector: ${LASSO_CONNECTOR_VERSION}`)).toBe(true);
    expect(events.find((e) => e.eventType === "mcp.push")?.dims["connector_version"]).toBe(LASSO_CONNECTOR_VERSION);
    const transcript = table("work_items").find((r) => r["type"] === "ai_thread");
    expect((transcript?.["source_meta"] as Row)?.["rejected_attachments"]).toEqual([expect.objectContaining({ title: "notes.docx", reason: "text_route_available" })]);
  });
  it("keeps every other parse failure a whole-call error", async () => {
    const response = await pushConversation(OWNER, { vendor: "claude", orig_conversation_id: "invalid",
      messages: msgs("Keep these."), attachments: [{ kind: "file_ref", title: "missing filename" }] }, 1);
    expect((await response.json() as { error: { message: string } }).error.message).toBe("A file_ref attachment needs file_ref.filename");
    expect(table("work_items")).toHaveLength(0);
  });
  it("appends the version to every served tool description", async () => {
    const response = await handleMcpRequest(new Request("https://example.test/mcp", { method: "POST", body: JSON.stringify({ method: "tools/list", id: 1 }) }), "key");
    const out = await response.json() as { result: { tools: { name: string; description: string }[] } };
    expect(out.result.tools.length).toBeGreaterThanOrEqual(12);
    for (const tool of out.result.tools) expect(tool.description.endsWith(`connector: ${LASSO_CONNECTOR_VERSION}`)).toBe(true);
  });
});

import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
it("allows the connector version on mcp.push", () => {
  expect(EVENT_DIM_KEYS["mcp.push"]).toContain("connector_version");
});
