import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasMoney, isSowItem, MONEY_WITHHELD, rowForReader } from "@/lib/money-mask-shared";

// The server client the helpers fall back to: an in-memory work_item_extracts and storage.
const adminExtracts: { work_item_id: string; summary: string | null }[] = [];
const stored = new Map<string, string>();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        in: async (_col: string, ids: string[]) => ({ data: table === "work_item_extracts" ? adminExtracts.filter((row) => ids.includes(row.work_item_id)) : [], error: null }),
      }),
    }),
  },
}));

const { moneyViewFor, sowSummariesForMember, viewText } = await import("@/lib/money-view.server");
const { readWorkboardCardPreviews } = await import("@/lib/workboard-card-preview.server");
const { readFilePreviews } = await import("@/lib/board-share-open.server");

const ORG = "org-1";
const SOW = { id: "sow-1", org_id: ORG, type: "document", title: "Statement of work, St. Brigid", meta: { sow_facts: { weeks: 16 } } };
const NOTE = { id: "note-1", org_id: ORG, type: "document", title: "Kickoff notes", meta: {} };
const SUMMARY = "Sixteen weeks. Fixed fee of $290,000, expenses capped at 8%.";

/** A caller's own client: profiles for resolveProfile, plus work_items, extracts and turns for the preview read. */
function callerDb(profiles: { id: string; org_id: string; role: string }[], rows: Record<string, unknown[]> = {}) {
  const chain = (data: unknown[]) => {
    const result = { data, error: null };
    const self: Record<string, unknown> = {
      eq: () => self, is: () => self, in: () => self,
      order: () => Object.assign(Promise.resolve(result), self),
      maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return self;
  };
  return {
    from: (table: string) => ({ select: () => chain(table === "profiles" ? profiles : (rows[table] ?? [])) }),
  } as never;
}

beforeEach(() => {
  adminExtracts.length = 0;
  stored.clear();
});

describe("isSowItem", () => {
  it.each([
    [{ type: "document", title: "Scope", meta: { sow_facts: { weeks: 12 } } }, true],
    [{ type: "document", title: "SOW v2", meta: {} }, true],
    [{ type: "deck", title: "Statement of Work - Larkspur", meta: null }, true],
    [{ type: "sheet", title: "Engagement letter", meta: {} }, true],
    [{ type: "ai_thread", title: "SOW questions", meta: {} }, false],
    [{ type: "document", title: "Sowing season notes", meta: {} }, false],
    [{ type: "document", title: "Kickoff notes", meta: { sow_facts: "text" } }, false],
    [{ type: null, title: "SOW", meta: {} }, false],
  ])("%j is a SOW: %s", (item, expected) => {
    expect(isSowItem(item)).toBe(expected);
  });
});

describe("moneyViewFor, per role", () => {
  it.each([
    ["admin", false],
    ["lead", false],
    ["em", true],
    ["coach", true],
  ])("a %s on a SOW: mask %s", async (role, mask) => {
    const view = await moneyViewFor(callerDb([{ id: "p1", org_id: ORG, role }]), "u1", SOW);
    expect(view.mask).toBe(mask);
    expect(hasMoney(viewText(view, SUMMARY))).toBe(!mask);
  });

  it("masks for someone with no profile in the item's workspace, even an admin elsewhere", async () => {
    const view = await moneyViewFor(callerDb([{ id: "p1", org_id: "other-org", role: "admin" }]), "u1", SOW);
    expect(view.mask).toBe(true);
  });

  it("never masks an item that is not a SOW, for anyone", async () => {
    for (const role of ["admin", "lead", "em", "coach"]) {
      const view = await moneyViewFor(callerDb([{ id: "p1", org_id: ORG, role }]), "u1", NOTE);
      expect(view.mask).toBe(false);
      expect(viewText(view, SUMMARY)).toBe(SUMMARY);
    }
  });
});

describe("rowForReader", () => {
  const row = { ...SOW, work_item_extracts: [{ summary: SUMMARY }] };
  it("leaves the row alone for admins and leads", () => {
    expect(rowForReader(row, true)).toBe(row);
  });
  it("masks a SOW's summary for a Member and keeps the rest", () => {
    const out = rowForReader(row, false);
    expect(out.work_item_extracts[0]!.summary).toBe(`Sixteen weeks. Fixed fee of ${MONEY_WITHHELD}, expenses capped at 8%.`);
    expect(out.title).toBe(row.title);
  });
  it("leaves a note's summary alone even for a Member", () => {
    const note = { ...NOTE, work_item_extracts: [{ summary: SUMMARY }] };
    expect(rowForReader(note, false)).toBe(note);
  });
});

describe("sowSummariesForMember", () => {
  it("reads only SOW summaries, with money removed", async () => {
    adminExtracts.push({ work_item_id: "sow-1", summary: SUMMARY }, { work_item_id: "note-1", summary: SUMMARY });
    const out = await sowSummariesForMember([SOW, NOTE]);
    expect([...out.keys()]).toEqual(["sow-1"]);
    expect(hasMoney(out.get("sow-1")!)).toBe(false);
    expect(out.get("sow-1")).toContain("Sixteen weeks");
  });
  it("reads nothing when no row is a SOW", async () => {
    expect((await sowSummariesForMember([NOTE])).size).toBe(0);
  });
});

describe("card previews", () => {
  const db = callerDb([], {
    turns: [],
    work_item_extracts: [{ work_item_id: "sow-1", summary: SUMMARY }, { work_item_id: "note-1", summary: SUMMARY }],
    work_items: [SOW, NOTE],
  });
  it("a Member asking for a SOW's id gets its summary without money", async () => {
    const rows = await readWorkboardCardPreviews(db, ["sow-1", "note-1"], false);
    expect(hasMoney(rows.find((row) => row.workItemId === "sow-1")!.summary!)).toBe(false);
    expect(rows.find((row) => row.workItemId === "note-1")!.summary).toBe(SUMMARY);
  });
  it("an admin or lead gets it as written", async () => {
    const rows = await readWorkboardCardPreviews(db, ["sow-1"], true);
    expect(rows[0]!.summary).toBe(SUMMARY);
  });
});

describe("public share link previews", () => {
  function shareDb(text: string, slides: unknown = null) {
    return {
      from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: slides ? [{ slide_map: slides, version_no: 1 }] : [], error: null }) }) }) }),
      storage: {
        from: () => ({
          download: async () => ({ data: new Blob([text]), error: null }),
          createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/sow.pdf" }, error: null }),
        }),
      },
    } as never;
  }
  const artifact = { ...SOW, content_ref: "u/sow.html", source_meta: { kind: "artifact_html", filename: "sow.html" } } as never;
  const pdf = { ...SOW, content_ref: "u/sow.pdf", source_meta: { mime_type: "application/pdf", filename: "sow.pdf" } } as never;

  it("never sends a SOW's PDF on a link, but still sends another PDF", async () => {
    const out = await readFilePreviews(shareDb(""), [pdf]);
    expect(out["sow-1"]!.url ?? null).toBeNull();
    const other = { ...NOTE, content_ref: "u/notes.pdf", source_meta: { mime_type: "application/pdf", filename: "notes.pdf" } } as never;
    const plain = await readFilePreviews(shareDb(""), [other]);
    expect(plain["note-1"]!.url).toBe("https://signed.example/sow.pdf");
  });

  it("masks a SOW deck's slide text on a link", async () => {
    const deck = { ...SOW, type: "deck", content_ref: "u/sow.pptx", source_meta: {} } as never;
    const out = await readFilePreviews(shareDb("", { slides: [{ title: "Fees", lines: ["Fixed fee $290,000", "16 weeks"] }] }), [deck]);
    const lines = (out["sow-1"] as { lines: string[] }).lines;
    expect(lines.join(" ")).toContain("16 weeks");
    expect(hasMoney(lines.join(" "))).toBe(false);
  });

  it("sends a SOW artifact with every figure masked", async () => {
    const out = await readFilePreviews(shareDb("<p>Fee: $290,000 fixed. Travel €40k.</p>"), [artifact]);
    const html = (out["sow-1"] as { html?: string }).html ?? "";
    expect(html).toContain("Fee:");
    expect(hasMoney(html)).toBe(false);
  });
});
