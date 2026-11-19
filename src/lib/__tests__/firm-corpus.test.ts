// 17 Nov: the firm reader, the one gate for Ask the firm and proposal precedents (firm-brain-review RECOMMENDATION
// section 5). Only shared boards; only placed, non-private work by non-guests; firm memory In, Summary only or Out;
// people on a board read it in full; a board with sharing off is gone on the next read because nothing is stored.
import { describe, expect, it, vi } from "vitest";

import {
  coverageLine,
  firmGrade,
  firmMemoryOf,
  withoutFees,
} from "@/lib/firm-corpus-shared";
import { assembleFirmCorpus, FIRM_CORPUS_TABLES, requireFirmMember, type FirmRows } from "@/lib/firm-corpus.server";

describe("firm memory", () => {
  it("defaults by type: deliverables in, notes and chats summary only, emails and messages out", () => {
    const of = (type: string) => firmMemoryOf({ type, meta: {}, shownToClient: false });
    expect(["document", "deck", "sheet"].map(of)).toEqual(["in", "in", "in"]);
    expect(["call", "ai_thread", "image"].map(of)).toEqual(["summary", "summary", "summary"]);
    expect(["email", "message"].map(of)).toEqual(["out", "out"]);
    expect(of("something-new")).toBe("summary");
  });

  it("lets a client mark make work readable, and an explicit choice win over both", () => {
    expect(firmMemoryOf({ type: "call", meta: {}, shownToClient: true })).toBe("in");
    expect(firmMemoryOf({ type: "deck", meta: { firm_memory: "out" }, shownToClient: true })).toBe("out");
    expect(firmMemoryOf({ type: "call", meta: { firm_memory: "in" }, shownToClient: false })).toBe("in");
    expect(firmMemoryOf({ type: "deck", meta: { firm_memory: "everyone" }, shownToClient: false })).toBe("in");
  });

  it("reads summary-only work in full for people on that board, and keeps Out out for everyone", () => {
    expect(firmGrade("summary", false)).toBe("summary");
    expect(firmGrade("summary", true)).toBe("full");
    expect(firmGrade("in", false)).toBe("full");
    expect(firmGrade("out", true)).toBeNull();
    // A call marked In stays summary only for people off its board, and opens in full for people on it.
    expect(firmGrade("in", false, "call")).toBe("summary");
    expect(firmGrade("in", true, "call")).toBe("full");
    expect(firmGrade("in", false, "document")).toBe("full");
    expect(firmGrade("out", true, "call")).toBeNull();
  });
});

describe("withholding fees", () => {
  it("replaces only the Fees section", () => {
    const body = "# Proposal\n\n## Team\nA partner.\n\n## Fees\n$380,000 fixed.\n\n## Assumptions\nNone.";
    const out = withoutFees(body);
    expect(out).not.toContain("380");
    expect(out).toContain("## Team\nA partner.");
    expect(out).toContain("## Assumptions\nNone.");
    expect(out).toContain("Shown to admins and leads only.");
  });

  it("handles a Fees section at the end", () => {
    expect(withoutFees("## Fees\n$120,000 fixed.")).not.toContain("120");
  });
});

describe("the coverage line", () => {
  it("counts shared boards and never names or counts unshared ones", () => {
    expect(coverageLine({ boards: [{}, {}] as never })).toBe("Read 2 engagements shared with the firm. Some engagements are not shared.");
  });
});

/** A small firm: two shared boards (b1, b2) as the reads return them. Unshared boards are never read at all. */
function rows(over: Partial<FirmRows> = {}): FirmRows {
  const item = (id: string, type: string, extra: Partial<FirmRows["items"][number]> = {}) => ({
    id,
    owner_id: "p-ana",
    type,
    title: `Title ${id}`,
    display_title: null,
    visibility: "mapped",
    work_date: "2025-03-01",
    meta: {},
    ...extra,
  });
  return {
    boards: [
      { id: "b1", title: "Service line", brief: "Design it", owner_id: "p-ana", outcome: "Ran to plan.", created_at: "2025-03-03T09:00:00Z", clients: { name: "St. Brigid", quick_folder: false } },
      { id: "b2", title: "Integration", brief: null, owner_id: "p-ben", outcome: null, created_at: "2025-08-04T09:00:00Z", clients: { name: "Inbox", quick_folder: true } },
    ],
    placements: [
      { work_item_id: "deck", engagement_id: "b1" },
      { work_item_id: "call", engagement_id: "b1" },
      { work_item_id: "email", engagement_id: "b1" },
      { work_item_id: "private", engagement_id: "b1" },
      { work_item_id: "guest", engagement_id: "b1" },
      { work_item_id: "out", engagement_id: "b2" },
      { work_item_id: "sow", engagement_id: "b2" },
      { work_item_id: "elsewhere", engagement_id: "b9" },
    ],
    items: [
      item("deck", "deck"),
      item("call", "call"),
      item("email", "email"),
      item("private", "document", { visibility: "private" }),
      item("guest", "document", { owner_id: "p-guest" }),
      item("out", "document", { meta: { firm_memory: "out" } }),
      item("sow", "document", { owner_id: "p-ben", meta: { sow_facts: { fee_amount: 210000 }, deliverable_kind: "sow" } }),
      item("unplaced", "document", { visibility: "unmapped" }),
      item("elsewhere", "document"),
    ],
    extracts: [
      { work_item_id: "deck", summary: "Old card", decisions: null, entities: null, created_at: "2025-03-01T00:00:00Z" },
      { work_item_id: "deck", summary: "New card", decisions: "Go", entities: "CFO", created_at: "2025-03-02T00:00:00Z" },
    ],
    showings: [
      { work_item_id: "deck", engagement_id: "b1", shown_on: "2025-04-02", occasion: "SteerCo 1" },
      { work_item_id: "deck", engagement_id: "b1", shown_on: "2025-03-31", occasion: "Pre-read" },
    ],
    people: [
      { id: "p-ana", display_name: "Ana", is_guest: false },
      { id: "p-ben", display_name: "Ben", is_guest: false },
      { id: "p-guest", display_name: "Gia", is_guest: true },
    ],
    askerBoards: [],
    ...over,
  };
}

describe("the corpus", () => {
  it("keeps only placed, non-private work by non-guests on shared boards, and nothing set to Out", () => {
    const corpus = assembleFirmCorpus("org", rows());
    expect(corpus.items.map((item) => item.id).sort()).toEqual(["call", "deck", "sow"]);
  });

  it("grades work for someone on no board: deliverables quoted, call notes by summary only", () => {
    const corpus = assembleFirmCorpus("org", rows());
    const grade = Object.fromEntries(corpus.items.map((item) => [item.id, item.grade]));
    expect(grade).toEqual({ deck: "full", call: "summary", sow: "full" });
  });

  it("gives a board's own people that board's call notes in full, and nobody else", () => {
    const corpus = assembleFirmCorpus("org", rows({ askerBoards: ["b1"] }));
    expect(corpus.items.find((item) => item.id === "call")!.grade).toBe("full");
    expect(corpus.boards.find((board) => board.id === "b1")!.askerIsOnBoard).toBe(true);
    expect(corpus.boards.find((board) => board.id === "b2")!.askerIsOnBoard).toBe(false);
    // Emails stay out even for the board's own people.
    expect(corpus.items.some((item) => item.id === "email")).toBe(false);
  });

  it("carries the latest index card, client marks in date order, SOW terms and kind", () => {
    const corpus = assembleFirmCorpus("org", rows());
    const deck = corpus.items.find((item) => item.id === "deck")!;
    expect(deck.summary).toBe("New card");
    expect(deck.shown.map((showing) => showing.on)).toEqual(["2025-03-31", "2025-04-02"]);
    const sow = corpus.items.find((item) => item.id === "sow")!;
    expect(sow.sowFacts).toEqual({ fee_amount: 210000 });
    expect(sow.kind).toBe("sow");
  });

  // 19 Nov (D-6): a saved proposal draft has no summary card, so the reader says what it is about from its own sections.
  describe("a saved proposal draft", () => {
    const section = (key: string, body: string, status = "draft") => ({
      key,
      heading: key,
      body,
      status,
      sources: [],
      flags: [],
    });
    const draftMeta = (sections: unknown[]) => ({
      deliverable_kind: "proposal",
      proposal_draft: {
        sections,
        questions: [],
        checks: {},
        precedentIds: [],
        createdAt: "2026-11-17",
      },
    });
    const withDraft = (meta: unknown, over: Partial<FirmRows> = {}): FirmRows => {
      const base = rows(over);
      return {
        ...base,
        placements: [
          ...base.placements,
          { work_item_id: "draft", engagement_id: "b2" },
          { work_item_id: "hidden-draft", engagement_id: "b9" },
        ],
        items: [
          ...base.items,
          {
            id: "draft",
            owner_id: "p-ben",
            type: "document",
            title: "Proposal draft",
            display_title: null,
            visibility: "mapped",
            work_date: null,
            meta,
          },
          {
            id: "hidden-draft",
            owner_id: "p-ben",
            type: "document",
            title: "Proposal draft elsewhere",
            display_title: null,
            visibility: "mapped",
            work_date: null,
            meta,
          },
        ],
      };
    };
    const SECTIONS = [
      section("context", "One in three adults has prediabetes.\n\nAlmost nobody is in a program."),
      section("objectives", "A board-approved service line by spring."),
      section(
        "approach",
        "Gap: nothing on this board or in past work supports this section yet. It is a question for the lead.",
        "gap",
      ),
      section("fee", "Fee: for partner decision."),
      section("team", "Partner; engagement lead; analyst."),
    ];

    it("is marked as a draft and carries what it is about, from its context, objectives and approach only", () => {
      const draft = assembleFirmCorpus("org", withDraft(draftMeta(SECTIONS))).items.find(
        (item) => item.id === "draft",
      )!;
      expect(draft.summary).toBeNull();
      expect(draft.proposalDraft).toEqual({
        gist: "One in three adults has prediabetes. Almost nobody is in a program. A board-approved service line by spring.",
      });
      expect(draft.grade).toBe("full");
    });

    it("says nothing for a draft that is all gaps, and still marks it", () => {
      const draft = assembleFirmCorpus(
        "org",
        withDraft(draftMeta([section("context", "", "draft"), SECTIONS[2]])),
      ).items.find((item) => item.id === "draft")!;
      expect(draft.proposalDraft).toEqual({ gist: null });
    });

    it("keeps a long draft's card short, with a share for each section", () => {
      const long = assembleFirmCorpus(
        "org",
        withDraft(
          draftMeta([section("context", "a ".repeat(900)), section("objectives", "Short aim.")]),
        ),
      ).items.find((item) => item.id === "draft")!;
      expect(long.proposalDraft!.gist!.length).toBeLessThanOrEqual(720);
      expect(long.proposalDraft!.gist).toContain("Short aim.");
    });

    it("leaves other work unmarked, and survives a draft stored in a shape it does not know", () => {
      const corpus = assembleFirmCorpus(
        "org",
        withDraft({ proposal_draft: { sections: "oops", questions: [] } }),
      );
      expect(corpus.items.filter((item) => item.proposalDraft).map((item) => item.id)).toEqual([]);
      const odd = assembleFirmCorpus(
        "org",
        withDraft(draftMeta([null, { key: "context", body: 7 }, section("objectives", "Aim.")])),
      ).items.find((item) => item.id === "draft")!;
      expect(odd.proposalDraft).toEqual({ gist: "Aim." });
    });

    it("stays out with its board: unshared, Out, private and guests' drafts are never in the corpus", () => {
      const ids = (found: FirmRows) =>
        assembleFirmCorpus("org", found).items.map((item) => item.id);
      // b9 is not among the shared boards read, so a draft placed only there is not found.
      expect(ids(withDraft(draftMeta(SECTIONS)))).not.toContain("hidden-draft");
      // Sharing turned off on b2: the draft goes with it at the next read.
      expect(
        ids(
          withDraft(draftMeta(SECTIONS), {
            boards: rows().boards.filter((board) => board.id !== "b2"),
          }),
        ),
      ).not.toContain("draft");
      expect(ids(withDraft({ ...draftMeta(SECTIONS), firm_memory: "out" }))).not.toContain("draft");
    });
  });

  it("names the lead and the client, but not a quick folder as a client", () => {
    const corpus = assembleFirmCorpus("org", rows());
    expect(corpus.boards[0]).toMatchObject({ client: "St. Brigid", lead: "Ana", startedOn: "2025-03-03", outcome: "Ran to plan." });
    expect(corpus.boards[1]!.client).toBeNull();
  });

  it("drops a board and all its work the moment it is no longer read as shared", () => {
    const before = assembleFirmCorpus("org", rows());
    const after = assembleFirmCorpus("org", rows({ boards: rows().boards.filter((board) => board.id !== "b2") }));
    expect(before.items.some((item) => item.boardId === "b2")).toBe(true);
    expect(after.items.some((item) => item.boardId === "b2")).toBe(false);
    expect(after.boards.map((board) => board.id)).toEqual(["b1"]);
  });

  it("opens only its fixed list of tables, never coaching ones", () => {
    expect(FIRM_CORPUS_TABLES.some((table) => /coach/.test(table))).toBe(false);
    expect(FIRM_CORPUS_TABLES).not.toContain("turns");
  });
});

/** Just enough of the client for the gate: profiles and orgs reads. */
function gateClient(profile: { role: string; is_guest: boolean; deactivated_at: string | null } | null, orgType: string) {
  const query = (table: string) => {
    const api = {
      select: () => api,
      eq: () => api,
      is: () => api,
      order: async () => ({ data: profile ? [{ id: "p1", org_id: "o1", role: profile.role }] : [], error: null }),
      maybeSingle: async () =>
        table === "orgs" ? { data: { settings: { type: orgType } }, error: null } : { data: profile ? { is_guest: profile.is_guest, deactivated_at: profile.deactivated_at } : null, error: null },
    };
    return api;
  };
  return { from: query } as never;
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({}) } }));

describe("who may ask the firm", () => {
  async function gate(profile: Parameters<typeof gateClient>[0], orgType = "company") {
    const client = gateClient(profile, orgType);
    const server = await import("@/integrations/supabase/client.server");
    (server as unknown as { supabaseAdmin: unknown }).supabaseAdmin = client;
    return requireFirmMember(client, "u1", "p1").then(
      () => "allowed",
      (error: unknown) => (error instanceof Response ? error.status : "error"),
    );
  }

  it("lets any active member of a company workspace in", async () => {
    expect(await gate({ role: "em", is_guest: false, deactivated_at: null })).toBe("allowed");
    expect(await gate({ role: "admin", is_guest: false, deactivated_at: null })).toBe("allowed");
  });

  it("refuses coaches, guests, the deactivated, people with no profile, and solo workspaces", async () => {
    expect(await gate({ role: "coach", is_guest: false, deactivated_at: null })).toBe(403);
    expect(await gate({ role: "em", is_guest: true, deactivated_at: null })).toBe(403);
    expect(await gate({ role: "em", is_guest: false, deactivated_at: "2026-01-01" })).toBe(403);
    expect(await gate(null)).toBe(403);
    expect(await gate({ role: "em", is_guest: false, deactivated_at: null }, "solo")).toBe(403);
  });
});
