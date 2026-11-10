import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  boardLinksToWork,
  buildTrail,
  trailLeadsWith,
  trailShowsWorkLink,
  type TrailInput,
  type TrailItem,
  type TrailWorkLink,
} from "@/lib/trail-shared";

const piece = (id: string, date = "2026-10-01", type = "document"): TrailItem => ({
  id,
  title: id,
  type,
  source_vendor: null,
  date,
});

function input(over: Partial<TrailInput> = {}): TrailInput {
  return {
    itemId: "deck",
    itemType: "deck",
    isOwner: true,
    parentId: null,
    childIds: [],
    workLinks: [],
    boardLinks: [],
    readable: new Map(["chat", "memo", "sheet", "email", "call", "pdf"].map((id) => [id, piece(id)])),
    ...over,
  };
}

const link = (from: string, to: string, over: Partial<TrailWorkLink> = {}): TrailWorkLink => ({
  from_item_id: from,
  to_item_id: to,
  relation: "informed",
  status: "confirmed",
  source: "model",
  rationale: null,
  ...over,
});

describe("TRAIL T1: only what Lasso saw happen or a person confirmed", () => {
  it("the piece it was made in is Made from, as born; what was made in it is Used in", () => {
    const trail = buildTrail(input({ parentId: "chat", childIds: ["email"] }));
    expect(trail.madeFrom.map((e) => [e.item.id, e.how])).toEqual([["chat", "born"]]);
    expect(trail.usedIn.map((e) => [e.item.id, e.how])).toEqual([["email", "born"]]);
  });

  it("a confirmed work link reads in its own direction, with its reason", () => {
    const trail = buildTrail(input({ workLinks: [link("sheet", "deck", { rationale: "The 212 row is quoted on slide 2." }), link("deck", "call")] }));
    expect(trail.madeFrom[0]).toMatchObject({ item: { id: "sheet" }, how: "confirmed", note: "The 212 row is quoted on slide 2." });
    expect(trail.usedIn[0]).toMatchObject({ item: { id: "call" }, how: "confirmed" });
  });

  it("a model's draft and a discarded link never reach the trail", () => {
    const trail = buildTrail(input({ workLinks: [link("sheet", "deck", { status: "draft" }), link("memo", "deck", { status: "discarded" })] }));
    expect(trail.madeFrom).toEqual([]);
  });

  it("a reader who is not the owner sees confirmed links the model traced, not hand-made ones (today's rule)", () => {
    expect(trailShowsWorkLink(link("a", "b", { source: "person" }), false)).toBe(false);
    expect(trailShowsWorkLink(link("a", "b", { source: "model" }), false)).toBe(true);
    expect(trailShowsWorkLink(link("a", "b", { source: "person" }), true)).toBe(true);
  });

  it("an arrow drawn on the board is drawn, with the word the person chose", () => {
    const trail = buildTrail(input({ boardLinks: [{ from_item_id: "memo", to_item_id: "deck", relation: "cited" }] }));
    expect(trail.madeFrom[0]).toMatchObject({ item: { id: "memo" }, how: "drawn", relation: "cited" });
  });

  it("one piece appears once per direction, by its strongest reason: born, then confirmed, then drawn", () => {
    const trail = buildTrail(
      input({
        parentId: "chat",
        workLinks: [link("chat", "deck"), link("sheet", "deck")],
        boardLinks: [
          { from_item_id: "chat", to_item_id: "deck", relation: "context" },
          { from_item_id: "sheet", to_item_id: "deck", relation: "cited" },
        ],
      }),
    );
    expect(trail.madeFrom.map((e) => [e.item.id, e.how])).toEqual([
      ["chat", "born"],
      ["sheet", "confirmed"],
    ]);
  });

  it("a piece the reader may not open drops out, and nothing says how many did", () => {
    const trail = buildTrail(input({ parentId: "secret", workLinks: [link("hidden", "deck")] }));
    expect(trail.madeFrom).toEqual([]);
    expect(Object.keys(trail)).toEqual(["madeFrom", "usedIn", "leadsWith"]);
  });

  it("a link from the piece to itself is ignored", () => {
    const readable = new Map([["deck", piece("deck")]]);
    expect(buildTrail(input({ readable, boardLinks: [{ from_item_id: "deck", to_item_id: "deck", relation: null }] })).madeFrom).toEqual([]);
  });

  it("within a reason, older work comes first", () => {
    const readable = new Map([
      ["late", piece("late", "2026-10-09")],
      ["early", piece("early", "2026-09-01")],
    ]);
    const trail = buildTrail(input({ readable, workLinks: [link("late", "deck"), link("early", "deck")] }));
    expect(trail.madeFrom.map((e) => e.item.id)).toEqual(["early", "late"]);
  });

  it("a deliverable opens on what made it; a chat or a source opens on where it went", () => {
    expect(trailLeadsWith("deck")).toBe("made");
    expect(trailLeadsWith("document")).toBe("made");
    expect(trailLeadsWith("sheet")).toBe("made");
    expect(trailLeadsWith("ai_thread")).toBe("used");
    expect(trailLeadsWith("email")).toBe("used");
    expect(trailLeadsWith("call")).toBe("used");
  });
});

describe("TRAIL T1: board arrows become work links", () => {
  it("only arrows between two work cards count", () => {
    const nodes = [
      { id: "n1", work_item_id: "memo" },
      { id: "n2", work_item_id: "deck" },
      { id: "n3", work_item_id: null },
    ];
    const out = boardLinksToWork(nodes, [
      { from_node_id: "n1", to_node_id: "n2", relation: "cited" },
      { from_node_id: "n3", to_node_id: "n2", relation: "context" },
      { from_node_id: null, to_node_id: "n2", relation: "context" },
    ]);
    expect(out).toEqual([{ from_item_id: "memo", to_item_id: "deck", relation: "cited" }]);
  });
  it("two cards of the same work joined by an arrow are not a link", () => {
    expect(boardLinksToWork([{ id: "a", work_item_id: "x" }, { id: "b", work_item_id: "x" }], [{ from_node_id: "a", to_node_id: "b", relation: null }])).toEqual([]);
  });
});

describe("TRAIL T1: the server read (pinned in source)", () => {
  const src = readFileSync("src/lib/trail.functions.ts", "utf8");
  it("never reads the rest of the engagement", () => {
    expect(src).not.toMatch(/loadUpstreamItems|engagementItemIds/);
  });
  it("reads confirmed work links only", () => {
    expect(src).toContain('.eq("status", "confirmed")');
  });
  it("never reads who drew an arrow or made a link", () => {
    expect(src).not.toMatch(/author_profile_id|created_by|owner_id, org_id, type, parent_work_item_id[\s\S]*author/);
    expect(src).not.toContain("created_by");
  });
  it("reads as the caller, so row policies decide what is readable", () => {
    expect(src).toContain("requireSupabaseAuth");
    expect(src).not.toMatch(/service_role|supabaseAdmin|createAdminClient/);
  });
  it("hides vendors from a reader the workspace keeps vendor-neutral", () => {
    expect(src).toContain('const vendorVisible = isOwner || org?.vendor_display !== "vendor_neutral";');
  });
});
