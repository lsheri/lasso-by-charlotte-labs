import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENT_DIM_KEYS, guardEventDims } from "../event-dim-allowlist";

type Row = Record<string, unknown>;
const mocks = vi.hoisted(() => ({
  inserts: [] as { table: string; rows: Row[] }[],
  filters: [] as [string, string, unknown][],
  thread: null as Row | null,
  turns: [] as Row[],
  readOnly: false,
  placed: false,
  recordEvent: vi.fn(),
  upload: vi.fn(),
  ensureExtracts: vi.fn(),
  noteModelUsed: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: vi.fn(async (name: string) => ({ data: name === "mcp_resolve_key" ? [{
    connection_id: "connection-1", profile_id: "profile-1", org_id: "org-1", user_id: "user-1",
    kind: "link", read_only: mocks.readOnly, legacy: false,
  }] : name === "mcp_place_item" ? { status: mocks.placed ? "placed" : "error" } : null, error: null })),
  storage: { from: () => ({ upload: mocks.upload }) },
  from(table: string) {
    let inserting = false;
    const result = () => ({ data: inserting ? { id: "document-1" } : table === "work_items" ? mocks.thread : null, error: null });
    const rows = () => table === "turns" ? mocks.turns : table === "engagement_members" ? [{ engagement_id: "board-1", member_role: "member" }]
      : table === "engagements" ? [{ id: "board-1", code: "ABC-01", title: "Pricing", clients: null }]
      : table === "tasks" ? [{ id: "task-1", engagement_id: "board-1", name: "Pricing" }] : [];
    const query = {
      select: (_columns?: string) => query,
      eq: (key: string, value: unknown) => { mocks.filters.push([table, key, value]); return query; },
      in: (_key: string, _values: unknown[]) => query,
      maybeSingle: async () => result(),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: rows(), error: null }),
      insert: (value: Row | Row[]) => { inserting = true; mocks.inserts.push({ table, rows: Array.isArray(value) ? value : [value] }); return query; },
    };
    return query;
  },
} }));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: mocks.recordEvent, recordAnonymousEvent: vi.fn() }));
vi.mock("@/lib/org-type.server", () => ({ orgTypeOfStrict: vi.fn(async () => "company"), isAffiliatedStrict: vi.fn(async () => false) }));
vi.mock("@/lib/extract.server", () => ({ ensureExtracts: mocks.ensureExtracts }));
vi.mock("@/lib/work-taxonomy.server", () => ({ noteModelUsed: mocks.noteModelUsed, noteThreadShape: vi.fn() }));

import { handleMcpRequest } from "../mcp-handler.server";

async function call(args: Row, method = "tools/call") {
  const response = await handleMcpRequest(new Request("https://x.test/api/mcp/key", {
    method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { name: "lasso_push_decisions", arguments: args } }),
  }), "test-key");
  return response.json();
}
const input = { title: "Pricing decisions", decisions: [{ statement: "Start in Germany" }, { statement: "Offer annual plans" }] };
const inserted = (table: string) => mocks.inserts.filter((entry) => entry.table === table).flatMap((entry) => entry.rows);
const threadId = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  mocks.inserts = []; mocks.filters = []; mocks.thread = null; mocks.turns = []; mocks.readOnly = false; mocks.placed = false;
  mocks.recordEvent.mockReset(); mocks.upload.mockReset().mockResolvedValue({ error: null });
  mocks.ensureExtracts.mockReset(); mocks.noteModelUsed.mockReset();
});

describe("MCP-DOC-1a first Decisions document push", () => {
  it("lists the tool with the two required arguments", async () => {
    const response = await call({}, "tools/list");
    const tool = response.result.tools.find((entry: Row) => entry.name === "lasso_push_decisions");
    expect(tool.inputSchema.required).toEqual(["title", "decisions"]);
    expect(tool.inputSchema.properties.decisions).toMatchObject({ minItems: 1, maxItems: 40 });
  });
  it("inserts one Decisions document, a first version and two ordered draft lines", async () => {
    const response = await call(input);
    expect(inserted("work_items")).toHaveLength(1);
    expect(inserted("work_items")[0]).toMatchObject({ doc_kind: "decisions", type: "document", owner_id: "profile-1", content_fidelity: "verbatim" });
    expect(inserted("decisions")).toEqual([
      expect.objectContaining({ document_id: "document-1", ord: 1, status: "draft", why: "", engagement_id: null, srcs: [] }),
      expect.objectContaining({ document_id: "document-1", ord: 2, status: "draft", why: "", engagement_id: null, srcs: [] }),
    ]);
    expect(inserted("document_versions")[0]).toMatchObject({ version_no: 1, parent_version_id: null, source_event: "mcp_push", origin: "model_artifact" });
    expect(response.result.content[0].text).toContain("lasso_document_id: document-1");
    expect(mocks.ensureExtracts).toHaveBeenCalledWith(["document-1"]);
  });
  it.each([["agreed", "confirmed"], ["dropped", "discarded"], ["open", "draft"]])("maps %s to %s", async (status, expected) => {
    await call({ ...input, decisions: [{ statement: "Keep the offer", status }] });
    expect(inserted("decisions")[0]?.status).toBe(expected);
  });
  it.each([
    [{ title: " " }, "title"],
    [{ decisions: [] }, "decisions"],
    [{ decisions: Array.from({ length: 41 }, () => ({ statement: "A" })) }, "decisions"],
    [{ decisions: [{}] }, "statement"],
    [{ decisions: [{ statement: " " }] }, "statement"],
    [{ decisions: [{ statement: "a".repeat(401) }] }, "statement"],
    [{ decisions: [{ statement: "A", reason: "a".repeat(1001) }] }, "reason"],
    [{ decisions: [{ statement: "A", status: "invented" }] }, "status"],
    [{ decisions: [{ statement: "A", produced_at_turn: 0 }] }, "produced_at_turn"],
    [{ decisions: [{ statement: "A", produced_at_turn: 1.5 }] }, "produced_at_turn"],
  ])("rejects invalid input before writing: %j", async (change, field) => {
    const response = await call({ ...input, ...change });
    expect(response.error.code).toBe(-32602); expect(response.error.message).toContain(field);
    expect(mocks.inserts).toHaveLength(0); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects a document re-push", async () => {
    const response = await call({ ...input, lasso_document_id: "document-1" });
    expect(response.error).toMatchObject({ code: -32602, message: "Updating an existing Decisions document is not available yet; push with a new title or leave lasso_document_id out." });
    expect(mocks.inserts).toHaveLength(0);
  });
  it("refuses a read-only connection", async () => {
    mocks.readOnly = true;
    expect((await call(input)).error.code).toBe(-32603); expect(mocks.inserts).toHaveLength(0);
  });
  it("copies the owned chat link and records pointers only for stored positions", async () => {
    mocks.thread = { id: threadId, source_meta: { url: "https://claude.ai/chat/example" } }; mocks.turns = [{ turn_no: 3 }];
    await call({ ...input, lasso_conversation_id: threadId, decisions: [{ statement: "A", produced_at_turn: 3 }, { statement: "B", produced_at_turn: 4 }] });
    expect(inserted("work_items")[0]).toMatchObject({ parent_work_item_id: threadId, source_meta: { url: "https://claude.ai/chat/example" } });
    expect(mocks.filters).toEqual(expect.arrayContaining([["work_items", "owner_id", "profile-1"], ["work_items", "org_id", "org-1"], ["work_items", "type", "ai_thread"]]));
    expect(inserted("decisions").map((line) => line.srcs)).toEqual([[{ turn: 3 }], []]);
    const events = mocks.recordEvent.mock.calls.map((call) => call[1]);
    expect(events.filter((event) => event.eventType === "decisions_doc.created")).toEqual([expect.objectContaining({ dims: { via: "pushed", lines: "1-10" } })]);
    expect(events.filter((event) => event.eventType === "decisions_doc.decision_added").map((event) => event.dims)).toEqual([{ via: "pushed", has_pointer: true }, { via: "pushed", has_pointer: false }]);
    expect(events.find((event) => event.eventType === "mcp.push")?.dims).toMatchObject({ tool: "lasso_push_decisions", kind: "decisions", stage: "capture" });
  });
  it("rejects a conversation not owned by the caller", async () => {
    expect((await call({ ...input, lasso_conversation_id: threadId })).error.code).toBe(-32602);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("inherits the source chat by original conversation id", async () => {
    mocks.thread = { id: threadId, source_meta: {} };
    await call({ ...input, orig_conversation_id: "original" });
    expect(inserted("work_items")[0]).toMatchObject({ parent_work_item_id: threadId, orig_conversation_id: "original" });
    expect(mocks.filters).toContainEqual(["work_items", "orig_conversation_id", "original"]);
  });
  it("sets engagement_id from successful placement without an extra board query", async () => {
    mocks.placed = true;
    await call({ ...input, destination: "ABC-01/Pricing" });
    expect(inserted("decisions").map((row) => row.engagement_id)).toEqual(["board-1", "board-1"]);
  });
  it("uploads markdown with a unique non-overwriting path and stated reasons", async () => {
    await call({ ...input, decisions: [{ statement: "A", reason: "Because B", status: "agreed" }] });
    const [path, body, options] = mocks.upload.mock.calls[0] ?? [];
    expect(path).toMatch(/^user-1\/decisions-pricing-decisions-[0-9a-f-]+\.md$/);
    expect(options).toEqual({ contentType: "text/markdown", upsert: false });
    expect(new TextDecoder().decode(body)).toBe("# Pricing decisions\n\n1. A\n   Status: Agreed\n   Why: Because B");
  });
  it("registers exactly the requested content-free dimensions", () => {
    expect(EVENT_DIM_KEYS["decisions_doc.created"]).toEqual(["via", "lines"]);
    expect(EVENT_DIM_KEYS["decisions_doc.decision_added"]).toEqual(["via", "has_pointer"]);
    expect(guardEventDims("mcp.push", { kind: "decisions", title: "private" }).dims).toEqual({ kind: "decisions" });
  });
});