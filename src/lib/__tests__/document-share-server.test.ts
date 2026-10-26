import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const state = vi.hoisted(() => ({ db: null as unknown, editor: true, events: vi.fn(), anonymous: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ get supabaseAdmin() { return state.db; } }));
vi.mock("@/lib/telemetry.server", () => ({
  sha256Hex: async (text: string) => createHash("sha256").update(text).digest("hex"),
  recordEvent: (...args: unknown[]) => state.events(...args),
  recordAnonymousEvent: (...args: unknown[]) => state.anonymous(...args),
}));
vi.mock("../canvas-lab.server", () => ({ isEngagementEditor: async () => state.editor }));

import { addDocumentLinkComment, createDocumentShareLink, listDocumentShareLinks, openDocumentShareLink, revokeDocumentShareLink } from "../document-share.server";
import { generateShareToken, hashShareToken } from "../board-share.server";
import { EVENT_DIM_KEYS, guardEventDims } from "../event-dim-allowlist";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let context: { supabase: SupabaseClient<Database>; userId: string };
let token: string;
const future = "2099-01-01T00:00:00.000Z";
const past = "2000-01-01T00:00:00.000Z";

// Like sh3c1-public-link-no-turns: a thenable table builder; here filters and writes are real in-memory operations.
function fakeDb() {
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let operation = "read";
      let payload: Row = {};
      let fields = "*";
      let counted = false;
      let maximum = Infinity;
      let sort: { key: string; ascending: boolean } | null = null;
      const execute = () => {
        const all = tables[table] ?? [];
        let rows = all.filter((row) => filters.every((filter) => filter(row)));
        if (operation === "insert") {
          const row = { id: `${table}-${all.length + 1}`, created_at: new Date().toISOString(), opened_count: 0,
            revoked_at: null, last_opened_at: null, ...payload };
          all.push(row); tables[table] = all; rows = [row];
        } else if (operation === "update") {
          for (const row of rows) Object.assign(row, payload);
        }
        if (sort) { const { key, ascending } = sort; rows = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)); }
        const count = counted ? rows.length : null;
        rows = rows.slice(0, maximum).map((row) => fields === "*" ? structuredClone(row) : Object.fromEntries(fields.split(",").map((field) => [field.trim(), row[field.trim()]])));
        return { data: rows, error: null, count };
      };
      const builder = {
        select(value = "*", options?: { count?: string; head?: boolean }) { fields = value; counted = options?.count === "exact"; return builder; },
        eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return builder; },
        is(key: string, value: unknown) { filters.push((row) => (row[key] ?? null) === value); return builder; },
        gt(key: string, value: string) { filters.push((row) => String(row[key]) > value); return builder; },
        gte(key: string, value: string) { filters.push((row) => String(row[key]) >= value); return builder; },
        order(key: string, options?: { ascending?: boolean }) { sort = { key, ascending: options?.ascending !== false }; return builder; },
        limit(value: number) { maximum = value; return builder; },
        insert(value: Row) { operation = "insert"; payload = value; return builder; },
        update(value: Row) { operation = "update"; payload = value; return builder; },
        async maybeSingle() { const result = execute(); return { ...result, data: result.data[0] ?? null }; },
        async single() { const result = execute(); return { ...result, data: result.data[0] ?? null }; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(execute()).then(resolve); },
      };
      return builder;
    },
  };
}

beforeEach(async () => {
  state.events.mockReset(); state.anonymous.mockReset(); state.editor = true;
  token = generateShareToken();
  tables = {
    profiles: [{ id: "owner", org_id: "org", user_id: "user", role: "member", deactivated_at: null }],
    work_items: [{ id: "doc", owner_id: "owner", org_id: "org", doc_kind: "decisions", title: "Decisions", display_title: null, captured_at: past }],
    workboard_nodes: [{ work_item_id: "doc", workboard_id: "board", deleted_at: null }],
    workboards: [{ id: "board", engagement_id: "engagement" }],
    board_share_links: [{ id: "link", work_item_id: "doc", workboard_id: "board", org_id: "org", created_by: "owner", token_hash: await hashShareToken(token), created_at: past, expires_at: future, revoked_at: null, opened_count: 2, last_opened_at: null }],
    decisions: [{ id: "line", document_id: "doc", ord: 1, call_text: "Proceed", why: "Evidence", status: "draft", srcs: [{ turn: 12 }], owner_id: "owner" }],
    document_versions: [{ work_item_id: "doc", created_at: "2026-10-26T04:00:00.000Z" }],
    document_link_comments: [],
  };
  state.db = fakeDb();
  context = { supabase: state.db as SupabaseClient<Database>, userId: "user" };
});

describe("document share server", () => {
  it("owner creates a hashed one-time link on the document's board with 48 hour default", async () => {
    const start = Date.now();
    const result = await createDocumentShareLink(context, { document_id: "doc" });
    const row = tables["board_share_links"]?.[1];
    expect(result.status).toBe("created");
    expect(result.id).toBe(row?.["id"]);
    expect(row).toMatchObject({ work_item_id: "doc", workboard_id: "board", created_by: "owner", token_hash: await hashShareToken(result.token) });
    expect(row).not.toHaveProperty("token");
    expect(new Date(result.expiresAt).getTime() - start).toBeGreaterThanOrEqual(48 * 3600000);
    expect(new Date(result.expiresAt).getTime() - start).toBeLessThan(48 * 3600000 + 1000);
    expect(state.events).toHaveBeenCalledWith(context.supabase, expect.objectContaining({ dims: { action: "created", scope: "document" } }));
  });
  it("non-owner create is 403", async () => {
    const document = tables["work_items"]?.[0]; if (document) document["owner_id"] = "other";
    await expect(createDocumentShareLink(context, { document_id: "doc" })).rejects.toMatchObject({ status: 403 });
    expect(tables["board_share_links"]).toHaveLength(1);
  });
  it("skips boards the caller cannot edit and refuses when none qualify", async () => {
    state.editor = false;
    await expect(createDocumentShareLink(context, { document_id: "doc" })).rejects.toMatchObject({ status: 403 });
    expect(tables["board_share_links"]).toHaveLength(1);
  });
  it("custom expiry is used", async () => {
    const start = Date.now(); const result = await createDocumentShareLink(context, { document_id: "doc", expires_in_hours: 2 });
    expect(new Date(result.expiresAt).getTime() - start).toBeGreaterThanOrEqual(7200000);
    expect(new Date(result.expiresAt).getTime() - start).toBeLessThan(7201000);
  });
  it("list contains only live document links and no open count", async () => {
    tables["board_share_links"]?.push({ id: "revoked", work_item_id: "doc", expires_at: future, revoked_at: past },
      { id: "expired", work_item_id: "doc", expires_at: past, revoked_at: null },
      { id: "other", work_item_id: "other", expires_at: future, revoked_at: null });
    expect(await listDocumentShareLinks(context, { document_id: "doc" })).toEqual([{ id: "link", created_at: past, expires_at: future }]);
  });
  it("revoke is owner-only and records document scope", async () => {
    expect(await revokeDocumentShareLink(context, { document_id: "doc", id: "link" })).toEqual({ status: "revoked" });
    expect(tables["board_share_links"]?.[0]?.["revoked_at"]).toBeTruthy();
    expect(state.events).toHaveBeenCalledWith(context.supabase, expect.objectContaining({ dims: { action: "revoked", scope: "document" } }));
  });
  it("non-owner cannot revoke", async () => {
    const document = tables["work_items"]?.[0]; if (document) document["owner_id"] = "other";
    await expect(revokeDocumentShareLink(context, { document_id: "doc", id: "link" })).rejects.toMatchObject({ status: 403 });
    expect(tables["board_share_links"]?.[0]?.["revoked_at"]).toBeNull();
  });
  it("cannot revoke another document's link", async () => {
    const link = tables["board_share_links"]?.[0]; if (link) link["work_item_id"] = "other";
    expect(await revokeDocumentShareLink(context, { document_id: "doc", id: "link" })).toEqual({ status: "not_found" });
    expect(link?.["revoked_at"]).toBeNull();
  });
  it("opens the exact safe shape, with count-only increment and anonymous document event", async () => {
    tables["document_link_comments"]?.push({ id: "comment", decision_id: null, display_name: "Visitor", body: "Yes", created_at: past, work_item_id: "doc", share_link_id: "link" });
    const result = await openDocumentShareLink({ token });
    expect(result).toEqual({ title: "Decisions", updated_at: "2026-10-26T04:00:00.000Z",
      lines: [{ id: "line", ord: 1, statement: "Proceed", reason: "Evidence", status: "open", has_source: true, has_feedback: false }],
      comments: [{ id: "comment", decision_id: null, display_name: "Visitor", body: "Yes", created_at: past }] });
    const inspect = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      for (const [key, entry] of Object.entries(value)) { expect(["workboard_id", "owner_id", "turn", "name"]).not.toContain(key); inspect(entry); }
    }; inspect(result);
    expect(tables["board_share_links"]?.[0]).toMatchObject({ opened_count: 3, last_opened_at: null });
    expect(state.events).toHaveBeenCalledWith(state.db, expect.objectContaining({ orgId: "org", userId: null, dims: { action: "opened", scope: "document" } }));
  });
  it("falls back to capture date and maps the other two statuses without exposing source numbers", async () => {
    tables["document_versions"] = [];
    tables["decisions"] = [{ id: "a", document_id: "doc", ord: 2, call_text: "A", why: null, status: "confirmed", srcs: [] }, { id: "b", document_id: "doc", ord: 1, call_text: "B", why: null, status: "discarded", srcs: [] }];
    expect(await openDocumentShareLink({ token })).toMatchObject({ updated_at: past, lines: [{ id: "b", status: "dropped", has_source: false }, { id: "a", status: "agreed", has_source: false }] });
  });
  it("exposes only feedback presence, never passage content or target", async () => {
    tables["span_links"] = [{ from_item_id: "doc", locator: { decision_id: "line" }, quote: "Private passage", to_item_id: "private-call", to_locator: { at: "00:14" } }, { from_item_id: "other", locator: { decision_id: "line" }, quote: "Other passage" }];
    const result = await openDocumentShareLink({ token });
    expect(result).toMatchObject({ lines: [{ has_feedback: true }] });
    expect(JSON.stringify(result)).not.toMatch(/Private passage|private-call|00:14|Other passage/);
  });
  it.each(["expired", "revoked", "unknown", "no_document"])("refuses %s with only its closed reason", async (reason) => {
    const link = tables["board_share_links"]?.[0];
    if (link && reason === "expired") link["expires_at"] = past;
    if (link && reason === "revoked") link["revoked_at"] = past;
    if (reason === "unknown") tables["board_share_links"] = [];
    if (link && reason === "no_document") link["work_item_id"] = null;
    expect(await openDocumentShareLink({ token })).toEqual({ status: "closed", reason: reason === "no_document" ? "unknown" : reason });
    const dims = { action: "refused", scope: "document", reason: reason === "no_document" ? "unknown" : reason };
    if (reason === "unknown") expect(state.anonymous).toHaveBeenCalledWith("board.share_link", expect.any(String), dims);
    else expect(state.events).toHaveBeenCalledWith(state.db, expect.objectContaining({ dims }));
    expect(link?.["opened_count"]).toBe(2);
  });
  it("refuses a malformed token", async () => {
    expect(await openDocumentShareLink({ token: "short" })).toEqual({ status: "closed", reason: "unknown" });
    expect(state.anonymous).toHaveBeenCalledWith("board.share_link", expect.any(String), { action: "refused", reason: "unknown", scope: "document" });
  });
  it("stores trimmed comments with null blank name and no identity in its event", async () => {
    const result = await addDocumentLinkComment({ token, body: "  Hello  ", display_name: "  " });
    expect(result).toMatchObject({ body: "Hello", display_name: null, decision_id: null });
    expect(tables["document_link_comments"]?.[0]).toMatchObject({ share_link_id: "link", work_item_id: "doc" });
    expect(state.events).toHaveBeenCalledWith(state.db, { eventType: "decisions_doc.link_comment_added", orgId: "org", userId: null, dims: { has_name: false, on_line: false } });
    expect(tables["board_share_links"]?.[0]?.["opened_count"]).toBe(2);
  });
  it("accepts a named comment on a line in this document", async () => {
    expect(await addDocumentLinkComment({ token, body: "Hello", display_name: " Visitor ", decision_id: "line" })).toMatchObject({ display_name: "Visitor", decision_id: "line" });
    expect(state.events).toHaveBeenCalledWith(state.db, expect.objectContaining({ dims: { has_name: true, on_line: true } }));
  });
  it.each([null, undefined, "", "   "])("stores an absent or blank name as null (%s)", async (display_name) => {
    expect(await addDocumentLinkComment({ token, body: "Hello", display_name })).toMatchObject({ display_name: null });
    expect(tables["document_link_comments"]?.[0]?.["display_name"]).toBeNull();
  });
  it("rejects an empty body", async () => {
    await expect(addDocumentLinkComment({ token, body: "  " })).rejects.toMatchObject({ status: 400 });
    expect(tables["document_link_comments"]).toHaveLength(0);
  });
  it("rejects body over 2000 characters", async () => {
    await expect(addDocumentLinkComment({ token, body: "x".repeat(2001) })).rejects.toMatchObject({ status: 400 });
  });
  it("rejects name over 60 characters", async () => {
    await expect(addDocumentLinkComment({ token, body: "Hello", display_name: "x".repeat(61) })).rejects.toMatchObject({ status: 400 });
  });
  it("rejects a decision from another document", async () => {
    tables["decisions"]?.push({ id: "other", document_id: "elsewhere" });
    await expect(addDocumentLinkComment({ token, body: "Hello", decision_id: "other" })).rejects.toMatchObject({ status: 400 });
    expect(tables["document_link_comments"]).toHaveLength(0);
  });
  it.each(["revoked", "expired"])("cannot comment on a %s link", async (reason) => {
    const link = tables["board_share_links"]?.[0]; if (link) link[reason === "revoked" ? "revoked_at" : "expires_at"] = past;
    expect(await addDocumentLinkComment({ token, body: "Hello" })).toMatchObject({ status: "closed" });
    expect(tables["document_link_comments"]).toHaveLength(0);
  });
  it("accepts the 30th and refuses the 31st comment in one hour", async () => {
    tables["document_link_comments"] = Array.from({ length: 29 }, (_, i) => ({ id: String(i), share_link_id: "link", created_at: new Date().toISOString() }));
    expect(await addDocumentLinkComment({ token, body: "Number 30" })).toMatchObject({ body: "Number 30" });
    expect(await addDocumentLinkComment({ token, body: "Number 31" })).toMatchObject({ status: "refused", message: expect.any(String) });
    expect(tables["document_link_comments"]).toHaveLength(30);
  });
  it("old comments and other links do not consume this hour's allowance", async () => {
    tables["document_link_comments"] = Array.from({ length: 31 }, (_, i) => ({ id: String(i), share_link_id: "link", created_at: past }));
    tables["document_link_comments"].push(...Array.from({ length: 31 }, (_, i) => ({ id: `other${i}`, share_link_id: "other", created_at: new Date().toISOString() })));
    expect(await addDocumentLinkComment({ token, body: "Hello" })).toMatchObject({ body: "Hello" });
  });
  it("registers additive content-free event dimensions", () => {
    expect(EVENT_DIM_KEYS["board.share_link"]).toEqual(["action", "reason", "scope"]);
    expect(guardEventDims("decisions_doc.link_comment_added", { has_name: true, on_line: false, body: "private" }).dims).toEqual({ has_name: true, on_line: false });
  });
});