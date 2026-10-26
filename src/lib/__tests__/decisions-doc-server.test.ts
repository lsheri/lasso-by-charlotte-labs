import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
type Row = Database["public"]["Tables"]["decisions"]["Row"];
type AnyRow = Record<string, unknown>;
const h = vi.hoisted(() => ({ profile: { id: "p1", org_id: "o1", role: "em" } as AnyRow | null,
  document: {} as AnyRow, lines: [] as AnyRow[], turns: [] as AnyRow[], writes: [] as { table: string; action: string; value?: unknown }[],
  event: vi.fn(), upload: vi.fn(), version: vi.fn(),
}));
vi.mock("@/lib/profile-resolve", () => ({ resolveProfile: async () => h.profile }));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: h.event }));
vi.mock("@/lib/connector-import.server", () => ({ recordNewVersion: h.version }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ middleware: () => ({ inputValidator: (validator: unknown) => ({ handler: (handler: unknown) => ({ handler, validator }) }) }) }) }));
import { updateDecisionLine, addDecisionLine, removeDecisionLine, restoreDecisionLine, reorderDecisionLines, setDecisionPointer, recordDecisionsVersion } from "../decisions-doc.server";
import * as functions from "../decisions.functions";
import { renderDecisionsMarkdown } from "../mcp-decisions";
import { ledgerTurnOf, statusWord, LEDGER_LINES_KEY } from "@/hooks/use-decision-lines";
import { EVENT_DIM_KEYS } from "../event-dim-allowlist";

function client() {
  return {
    storage: { from: () => ({ upload: h.upload }) },
    from(table: string) {
      const filters: AnyRow = {};
      let action = "select";
      let value: AnyRow = {};
      let ascending = true;
      const matches = (row: AnyRow) => Object.entries(filters).every(([key, expected]) => row[key] === expected);
      const run = () => {
        let rows = table === "work_items" ? [h.document].filter(matches) : table === "decisions" ? h.lines.filter(matches) : table === "turns" ? h.turns.filter(matches) : [];
        if (action === "insert") {
          rows = [{ id: "new-id", created_at: "2026-10-26", pattern_tags: [], resolved_at: null, date_label: null, ...value }];
          h.lines.push(...rows);
        } else if (action === "update") {
          rows = rows.map((row) => Object.assign(row, value));
        } else if (action === "delete") {
          h.lines = h.lines.filter((row) => !matches(row));
        }
        if (action !== "select") h.writes.push({ table, action, value });
        return { data: rows.map((row) => structuredClone(row)).sort((a, b) => ascending ? Number(a["ord"] ?? 0) - Number(b["ord"] ?? 0) : Number(b["ord"] ?? 0) - Number(a["ord"] ?? 0)), error: null };
      };
      const q = {
        select: () => q,
        eq: (key: string, expected: unknown) => { filters[key] = expected; return q; },
        order: (_key: string, options: { ascending: boolean }) => { ascending = options.ascending; return q; },
        update: (patch: AnyRow) => { action = "update"; value = patch; return q; },
        insert: (row: AnyRow) => { action = "insert"; value = row; return q; },
        delete: () => { action = "delete"; return q; },
        single: async () => { const result = run(); return { ...result, data: result.data[0] ?? null }; },
        maybeSingle: async () => { const result = run(); return { ...result, data: result.data[0] ?? null }; },
        then: (resolve: (result: unknown) => unknown) => resolve(run()),
      };
      return q;
    },
  } as never;
}
const row = (change: Partial<Row> = {}): Row => ({ id: "a", document_id: "d1", owner_id: "p1", ord: 1, call_text: "A", why: "", status: "draft", srcs: [],
  situation: "Pricing", author: "ai_draft", engagement_id: "e1", created_at: "2026-10-25", resolved_at: null, pattern_tags: ["pricing"], date_label: "25 Oct", ...change });
const context = () => ({ supabase: client(), userId: "u1" });
const doc = { document_id: "d1" };
beforeEach(() => {
  h.profile = { id: "p1", org_id: "o1", role: "em" };
  h.document = { id: "d1", owner_id: "p1", org_id: "o1", doc_kind: "decisions", title: "Pricing", parent_work_item_id: "chat1", content_ref: "old.md", content_hash: "old", captured_at: "2026-10-25", source_meta: { role: "decisions" } };
  h.lines = [row()]; h.turns = []; h.writes = [];
  h.event.mockReset(); h.upload.mockReset().mockResolvedValue({ error: null }); h.version.mockReset().mockResolvedValue(2);
});

describe("Decisions document owner operations", () => {
  it.each(["update", "add", "remove", "restore", "reorder", "pointer", "version"] as const)("rejects non-owner and wrong document kind before %s writes", async (action) => {
    const run = () => ({ update: () => updateDecisionLine(context(), { ...doc, id: "a", patch: { status: "confirmed" } }),
      add: () => addDecisionLine(context(), { ...doc, call_text: "B" }), remove: () => removeDecisionLine(context(), { ...doc, id: "a" }),
      restore: () => restoreDecisionLine(context(), { ...doc, row: row() }), reorder: () => reorderDecisionLines(context(), { ...doc, ids_in_order: ["a"] }),
      pointer: () => setDecisionPointer(context(), { ...doc, id: "a", turn: null }), version: () => recordDecisionsVersion(context(), doc),
    }[action]?.());
    h.document["owner_id"] = "other";
    await expect(run()).rejects.toMatchObject({ status: 403 });
    h.document["owner_id"] = "p1"; h.document["doc_kind"] = null;
    await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(h.writes).toHaveLength(0); expect(h.upload).not.toHaveBeenCalled();
  });
  it("rejects a missing profile", async () => {
    h.profile = null;
    await expect(addDecisionLine(context(), { ...doc, call_text: "B" })).rejects.toMatchObject({ status: 403 });
  });
  it("records status words and content-free edits", async () => {
    const updated = await updateDecisionLine(context(), { ...doc, id: "a", patch: { status: "confirmed", call_text: "  B  ", why: "Reason" } });
    expect(updated).toMatchObject({ status: "confirmed", call_text: "B", why: "Reason" });
    expect(h.event.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ eventType: "decisions_doc.decision_status_changed", dims: { from: "open", to: "agreed", via: "ledger" } }),
      expect.objectContaining({ eventType: "decisions_doc.line_changed", dims: { action: "edited", via: "ledger" } }),
    ]);
  });
  it("does not emit changes for identical values", async () => {
    await updateDecisionLine(context(), { ...doc, id: "a", patch: { status: "draft", call_text: "A", why: "" } });
    expect(h.event).not.toHaveBeenCalled();
  });
  it.each([{ call_text: " " }, { call_text: "x".repeat(401) }, { why: "x".repeat(1001) }, { status: "unknown" }])("rejects invalid fields: %j", async (patch) => {
    await expect(updateDecisionLine(context(), { ...doc, id: "a", patch: patch as never })).rejects.toMatchObject({ status: 400 });
    expect(h.writes).toHaveLength(0);
  });
  it("adds after the maximum ord as a human with the existing engagement", async () => {
    h.lines.push(row({ id: "b", ord: 7, status: "discarded" }));
    const added = await addDecisionLine(context(), { ...doc, call_text: " B " });
    expect(added).toMatchObject({ ord: 8, author: "human", engagement_id: "e1", situation: "Pricing", call_text: "B", status: "draft", srcs: [] });
    expect(h.event).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "decisions_doc.decision_added", dims: { via: "typed", has_pointer: false } }));
  });
  it("starts at ord 1 with no engagement when there are no lines", async () => {
    h.lines = [];
    expect(await addDecisionLine(context(), { ...doc, call_text: "B" })).toMatchObject({ ord: 1, engagement_id: null });
  });
  it("returns every removed field for undo", async () => {
    const original = row();
    expect(await removeDecisionLine(context(), { ...doc, id: "a" })).toEqual(original);
    expect(h.lines).toHaveLength(0);
  });
  it("restores the exact row and id, then no-ops on duplicate", async () => {
    const original = row(); h.lines = [];
    expect(await restoreDecisionLine(context(), { ...doc, row: original })).toEqual(original);
    expect(h.writes[0]?.value).toEqual(original);
    expect(await restoreDecisionLine(context(), { ...doc, row: original })).toEqual(original);
    expect(h.writes).toHaveLength(1); expect(h.event).toHaveBeenCalledTimes(1);
  });
  it.each([{ owner_id: "other" }, { document_id: "other" }])("rejects foreign restore rows: %j", async (change) => {
    await expect(restoreDecisionLine(context(), { ...doc, row: row(change) })).rejects.toMatchObject({ status: 400 });
    expect(h.writes).toHaveLength(0);
  });
  it.each([["other"], ["a", "a"], []])("rejects a wrong reorder set: %j", async (...ids) => {
    await expect(reorderDecisionLines(context(), { ...doc, ids_in_order: ids })).rejects.toMatchObject({ status: 400 });
    expect(h.writes).toHaveLength(0);
  });
  it("reorders the exact set with one event", async () => {
    h.lines.push(row({ id: "b", ord: 2 }));
    const result = await reorderDecisionLines(context(), { ...doc, ids_in_order: ["b", "a"] });
    expect(result.map((line) => [line.id, line.ord])).toEqual([["b", 1], ["a", 2]]);
    expect(h.event).toHaveBeenCalledTimes(1);
  });
  it("rejects an unstored turn and accepts only a turn in the parent chat", async () => {
    h.turns = [{ id: "wrong", work_item_id: "another-chat", turn_no: 3 }];
    await expect(setDecisionPointer(context(), { ...doc, id: "a", turn: 3 })).rejects.toMatchObject({ status: 400 });
    expect(h.writes).toHaveLength(0);
    h.turns.push({ id: "right", work_item_id: "chat1", turn_no: 3 });
    expect(await setDecisionPointer(context(), { ...doc, id: "a", turn: 3 })).toMatchObject({ srcs: [{ turn: 3 }] });
    expect(await setDecisionPointer(context(), { ...doc, id: "a", turn: null })).toMatchObject({ srcs: [] });
  });
  it("stores a human-edited version with origin omitted and exact version dimensions", async () => {
    h.lines.push(row({ id: "b", ord: 2, status: "discarded" }));
    expect(await recordDecisionsVersion(context(), doc)).toEqual({ version_no: 2 });
    const args = h.version.mock.calls[0]?.[1];
    expect(args).toMatchObject({ sourceEvent: "ledger_edit", previousRef: "old.md", previousHash: "old", previousAt: "2026-10-25" });
    expect(args).not.toHaveProperty("origin");
    expect(h.upload.mock.calls[0]?.[0]).toMatch(/^u1\/decisions-pricing-[0-9a-f-]+\.md$/);
    expect(h.upload.mock.calls[0]?.[2]).toEqual({ contentType: "text/markdown", upsert: false });
    expect(h.writes.find((write) => write.table === "work_items")?.value).toMatchObject({ source_meta: { role: "decisions", lines: 1, dropped: 1 } });
    expect(h.event).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "decisions_doc.version_recorded", dims: { changed: "ledger", added: "0", dropped: "0" } }));
    expect(EVENT_DIM_KEYS["decisions_doc.version_recorded"]).toEqual(["changed", "added", "dropped"]);
  });
  it("uses the pinned shared markdown format", () => {
    expect(renderDecisionsMarkdown("Pricing", [row(), row({ ord: 2, call_text: "B", why: "Because", status: "confirmed" }), row({ ord: 3, call_text: "C", status: "discarded" })].map((line) => ({ ...line, ord: line.ord ?? 0 })))).toBe("# Pricing\n\n1. A\n   Status: Open\n\n2. B\n   Status: Agreed\n   Why: Because\n\n3. C\n   Status: Dropped");
  });
  it.each([null, [], [{ turn: 0 }], [{ turn: 1.5 }], [{ turn: "3" }], [{ turn_id: "uuid" }]])("ignores non-ledger pointers: %j", (srcs) => {
    expect(ledgerTurnOf({ srcs })).toBeNull();
  });
  it("reads numeric ledger pointers and labels without legacy sources", () => {
    expect(ledgerTurnOf({ srcs: [{ turn: 3 }] })).toBe(3);
    expect([statusWord("draft"), statusWord("confirmed"), statusWord("discarded")]).toEqual(["Open", "Agreed", "Dropped"]);
    expect(LEDGER_LINES_KEY("d1")).toEqual(["decision-lines", "d1"]);
  });
  it("exports all seven authenticated entry points", () => {
    expect([functions.updateDecisionLine, functions.addDecisionLine, functions.removeDecisionLine, functions.restoreDecisionLine, functions.reorderDecisionLines, functions.setDecisionPointer, functions.recordDecisionsVersion]).toHaveLength(7);
  });
});