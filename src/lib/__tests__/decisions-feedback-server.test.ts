import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ profile: { id: "owner", org_id: "org" } as Record<string, unknown> | null, db: null as unknown, event: vi.fn() }));
vi.mock("@/lib/profile-resolve", () => ({ resolveProfile: async () => h.profile }));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: h.event }));
vi.mock("@/lib/connector-import.server", () => ({ recordNewVersion: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ get supabaseAdmin() { return h.db; } }));
import { linkPassageToDecision, stripPassageSpeaker, unlinkPassage } from "../decisions-doc.server";
import { guardEventDims } from "../event-dim-allowlist";
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
function db() {
  return { from(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    let op = "read"; let value: Row = {};
    const run = () => {
      let rows = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)));
      if (op === "insert") { rows = [{ id: "span", ...value }]; (tables[table] ??= []).push(...rows); }
      if (op === "delete") tables[table] = (tables[table] ?? []).filter((row) => !filters.every((f) => f(row)));
      return { data: structuredClone(rows), error: null };
    };
    const q = { select: () => q, eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; }, is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return q; }, limit: () => q,
      insert: (v: Row) => { op = "insert"; value = v; return q; }, delete: () => { op = "delete"; return q; },
      maybeSingle: async () => ({ ...run(), data: run().data[0] ?? null }), single: async () => { const r = run(); return { ...r, data: r.data[0] ?? null }; },
      then: (resolve: (r: unknown) => unknown) => Promise.resolve(run()).then(resolve) };
    return q;
  } };
}
const context = () => ({ supabase: h.db as never, userId: "user" });
const input = () => ({ document_id: "doc", id: "line", transcript_id: "call", quote: "Alice: We agreed to proceed", to_locator: { char_start: 0, char_end: 26, at: "00:14:30" } });
beforeEach(() => {
  h.profile = { id: "owner", org_id: "org" }; h.event.mockReset();
  tables = { work_items: [{ id: "doc", owner_id: "owner", org_id: "org", doc_kind: "decisions" }, { id: "call", type: "call", doc_kind: null }, { id: "file", type: "document", doc_kind: null }], decisions: [{ id: "line", document_id: "doc" }], workboards: [{ id: "board" }], workboard_nodes: [{ id: "n1", work_item_id: "doc", workboard_id: "board", deleted_at: null }, { id: "n2", work_item_id: "call", workboard_id: "board", deleted_at: null }, { id: "n3", work_item_id: "file", workboard_id: "board", deleted_at: null }], span_links: [] };
  h.db = db();
});
describe("decision feedback owner operations", () => {
  it("stores a speaker-free capped quote and exact existing human-link values", async () => {
    await linkPassageToDecision(context(), input());
    expect(tables["span_links"]?.[0]).toMatchObject({ asked_by: "owner", owner_id: "owner", org_id: "org", from_item_id: "doc", locator: { decision_id: "line" }, to_item_id: "call", to_turn_id: null, quote: "We agreed to proceed", to_locator: { char_start: 0, char_end: 26, at: "00:14:30" }, status: "exact", verification: "none_in_record" });
    expect(h.event).toHaveBeenCalledWith(h.db, expect.objectContaining({ eventType: "span_link.created", dims: { via: "decisions_doc" } }));
  });
  it("permits an uploaded document on the same readable board", async () => {
    await linkPassageToDecision(context(), { ...input(), transcript_id: "file" });
    expect(tables["span_links"]?.[0]?.["to_item_id"]).toBe("file");
  });
  it("caps after stripping a leading speaker label at 600", () => {
    expect(stripPassageSpeaker(`Alice Smith: ${"x".repeat(700)}`)).toBe("x".repeat(600));
  });
  it("rejects a timestamp longer than 12", async () => {
    await expect(linkPassageToDecision(context(), { ...input(), to_locator: { char_start: 0, char_end: 1, at: "x".repeat(13) } })).rejects.toMatchObject({ status: 400 });
    expect(tables["span_links"]).toHaveLength(0);
  });
  it("accepts free text timestamp of 12", async () => {
    await linkPassageToDecision(context(), { ...input(), to_locator: { char_start: 0, char_end: 1, at: "x".repeat(12) } });
    expect(tables["span_links"]?.[0]?.["to_locator"]).toMatchObject({ at: "x".repeat(12) });
  });
  it("rejects another owner before writing", async () => {
    const row = tables["work_items"]?.[0]; if (row) row["owner_id"] = "other";
    await expect(linkPassageToDecision(context(), input())).rejects.toMatchObject({ status: 403 });
    expect(tables["span_links"]).toHaveLength(0); expect(h.event).not.toHaveBeenCalled();
  });
  it("rejects a transcript outside the board", async () => {
    tables["workboard_nodes"] = tables["workboard_nodes"]?.filter((row) => row["work_item_id"] !== "call") ?? [];
    await expect(linkPassageToDecision(context(), input())).rejects.toMatchObject({ status: 403 });
    expect(tables["span_links"]).toHaveLength(0);
  });
  it("rejects an unreadable board", async () => {
    tables["workboards"] = [];
    await expect(linkPassageToDecision(context(), input())).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a decision from another document", async () => {
    await expect(linkPassageToDecision(context(), { ...input(), id: "other" })).rejects.toMatchObject({ status: 400 });
  });
  it("rejects a decisions document as transcript", async () => {
    await expect(linkPassageToDecision(context(), { ...input(), transcript_id: "doc" })).rejects.toMatchObject({ status: 403 });
  });
  it("unlinks only a passage on the owned document", async () => {
    await linkPassageToDecision(context(), input());
    await unlinkPassage(context(), { document_id: "doc", span_link_id: "span" });
    expect(tables["span_links"]).toHaveLength(0);
  });
  it("refuses non-owner unlink", async () => {
    await linkPassageToDecision(context(), input()); h.profile = { id: "other", org_id: "org" };
    await expect(unlinkPassage(context(), { document_id: "doc", span_link_id: "span" })).rejects.toMatchObject({ status: 403 });
    expect(tables["span_links"]).toHaveLength(1);
  });
  it("via accepts the additive fixed value without carrying passage text", () => {
    expect(guardEventDims("span_link.created", { via: "decisions_doc", quote: "private" }).dims).toEqual({ via: "decisions_doc" });
  });
});
