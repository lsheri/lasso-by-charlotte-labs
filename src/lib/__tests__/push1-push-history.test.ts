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
      const rows = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({ id: newId(), ...r }));
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

import { handleMcpRequest, pushConversation } from "@/lib/mcp-handler.server";

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

describe("PUSH-1 push_conversation history", () => {
  it("a first push writes push_no 1, mode created, the turn counts and stamps every new turn", async () => {
    await push(msgs(...first));
    const [row] = pushes();
    expect(pushes()).toHaveLength(1);
    expect(row).toMatchObject({ push_no: 1, mode: "created", turns_added: 3, turns_changed: 0, turns_unchanged: 0, tool: "push_conversation", source_vendor: "claude", client_name: "Claude Desktop", consent_tier: "t2", consent_ledger_version: 3 });
    expect(stamped(row!["id"])).toEqual([1, 2, 3]);
  });

  it("a second push adding 2 and changing 1 writes push_no 2 appended and stamps only those 3; an identical third writes unchanged and stamps nothing", async () => {
    await push(msgs(...first));
    const second = [first[0]!, "Start with three segments and a survey, then interview ten buyers in each.", first[2]!, "Mid-market first.", "Agreed."];
    await push(msgs(...second));
    const row2 = pushes()[1]!;
    expect(row2).toMatchObject({ push_no: 2, mode: "appended", turns_added: 2, turns_changed: 1, turns_unchanged: 2 });
    expect(stamped(row2["id"])).toEqual([2, 4, 5]);
    expect(stamped(pushes()[0]!["id"])).toEqual([1, 3]);

    await push(msgs(...second));
    const row3 = pushes()[2]!;
    expect(row3).toMatchObject({ push_no: 3, mode: "unchanged", turns_added: 0, turns_changed: 0, turns_unchanged: 5 });
    expect(stamped(row3["id"])).toEqual([]);
  });

  it("a push with two attachments records attachments_added 2", async () => {
    await push(msgs(...first), { attachments: [
      { kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: "# Pricing plan\n\n" + "Segment the market by company size, then design a survey on willingness to pay. ".repeat(12) },
      { kind: "artifact_markdown", title: "Survey", source_artifact_id: "a2", content: "# Survey\n\n" + "Ask each buyer which features they would pay for and at what annual price point. ".repeat(12) },
    ] });
    expect(pushes()[0]).toMatchObject({ attachments_added: 2, attachments_changed: 0 });
  });

  it("a failing push-history insert does not fail the push and stamps nothing", async () => {
    failPushHistory = true;
    const ok = await push(msgs(...first));
    failPushHistory = false;
    expect(table("work_item_pushes")).toHaveLength(0);
    for (const t of table("turns")) expect(t["push_id"]).toBeUndefined();
    expect(ok.error).toBeUndefined();
    expect(ok.result?.content[0]?.text).toContain("Saved");
    expect(table("turns")).toHaveLength(3);
  });
});

async function tool(name: string, args: Record<string, unknown>) {
  const res = await handleMcpRequest(new Request("https://x.test/api/mcp/key", {
    method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  }), "test-key");
  return (await res.json()) as { result?: { content: { text: string }[] }; error?: unknown };
}

describe("PUSH-1 document pushes", () => {
  it("push_document writes one created row with attachments_added 1", async () => {
    const out = await tool("push_document", { filename: "notes.md", content: "Some notes." });
    expect(out.error).toBeUndefined();
    const doc = table("work_items")[0]!;
    expect(pushes()).toEqual([expect.objectContaining({ work_item_id: doc["id"], push_no: 1, mode: "created", attachments_added: 1, attachments_changed: 0, turns_added: 0, tool: "push_document", source_vendor: null })]);
  });

  it("a Decisions re-push writes push_no 2 appended and stamps the new document_versions row", async () => {
    await tool("lasso_push_decisions", { title: "Pricing decisions", decisions: [{ statement: "Start in Germany" }] });
    const doc = table("work_items").find((r) => r["doc_kind"] === "decisions")!;
    const v1 = table("document_versions").find((v) => v["version_no"] === 1)!;
    expect(v1["push_id"]).toBe(pushes()[0]!["id"]);
    const out = await tool("lasso_push_decisions", { title: "Pricing decisions", lasso_document_id: doc["id"], decisions: [{ statement: "Start in Germany" }, { statement: "Offer annual plans" }] });
    expect(out.error).toBeUndefined();
    const row2 = pushes()[1]!;
    expect(row2).toMatchObject({ push_no: 2, mode: "appended", attachments_added: 0, attachments_changed: 1, tool: "lasso_push_decisions", source_vendor: null });
    expect(table("document_versions").find((v) => v["version_no"] === 2)!["push_id"]).toBe(row2["id"]);
  });
});

describe("PUSH-1a push_thread history", () => {
  it("a first push_thread writes push_no 1 mode created with its turn counts and stamps its turns", async () => {
    const out = await tool("push_thread", { source_ai: "chatgpt", title: "Pricing", turns: [{ role: "user", content: "How should we price?" }, { role: "assistant", content: "Start with a survey." }] });
    expect(out.error).toBeUndefined();
    const [row] = pushes();
    expect(pushes()).toHaveLength(1);
    expect(row).toMatchObject({ push_no: 1, mode: "created", turns_added: 2, turns_changed: 0, turns_unchanged: 0, tool: "push_thread", source_vendor: "chatgpt" });
    expect(stamped(row!["id"])).toEqual([1, 2]);
  });
});
