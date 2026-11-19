// 18 Nov: Firm Brain Build Spec, step 5. The extractor now writes tags on every captured item's own meta, private and
// unplaced ones included, and a lead may correct them. The firm reader must still never serve a private item, an
// unplaced item, a guest's item, an item set to Out or an item on an unshared board, tags and corrections included.
import { describe, expect, it } from "vitest";

import { TAG_CORRECTION_KEY } from "@/lib/engagement-tags";
import { mergeExtractedTags, tagAskFor, validateExtractedTags } from "@/lib/extract-tags-shared";
import { assembleFirmGraph } from "@/lib/firm-graph-shared";
import { assembleFirmCorpus, FIRM_CORPUS_TABLES, type FirmRows } from "@/lib/firm-corpus.server";

/** What the extractor leaves on an item: a rare method and a situation, so a leak would be easy to see. */
const TAGGED = { method: ["outreach"], situation: "fundraising", stage: "draft", call_role: "investor" };
const CORRECTED = { ...TAGGED, [TAG_CORRECTION_KEY]: { method: ["market_sizing"], situation: "talent", by: "p-ana", at: "2026-11-18T10:00:00.000Z" } };

function rows(): FirmRows {
  const item = (id: string, extra: Partial<FirmRows["items"][number]> = {}): FirmRows["items"][number] => ({
    id,
    owner_id: "p-ana",
    type: "document",
    title: `Title ${id}`,
    display_title: null,
    visibility: "mapped",
    work_date: "2026-03-01",
    meta: {},
    ...extra,
  });
  return {
    boards: [{ id: "b1", title: "Service line", brief: null, owner_id: "p-ana", outcome: null, created_at: "2026-03-03T09:00:00Z", clients: { name: "St. Brigid", quick_folder: false } }],
    placements: [
      { work_item_id: "shared", engagement_id: "b1" },
      { work_item_id: "private", engagement_id: "b1" },
      { work_item_id: "private-corrected", engagement_id: "b1" },
      { work_item_id: "guest", engagement_id: "b1" },
      { work_item_id: "out", engagement_id: "b1" },
      { work_item_id: "unshared-board", engagement_id: "b9" },
    ],
    items: [
      item("shared", { meta: { method: ["survey"], stage: "reviewed" } }),
      item("private", { visibility: "private", meta: TAGGED }),
      item("private-corrected", { visibility: "private", meta: CORRECTED }),
      item("unplaced", { visibility: "unmapped", meta: CORRECTED }),
      item("guest", { owner_id: "p-guest", meta: CORRECTED }),
      item("out", { meta: { ...CORRECTED, firm_memory: "out" } }),
      item("unshared-board", { meta: CORRECTED }),
    ],
    extracts: [],
    showings: [],
    people: [
      { id: "p-ana", display_name: "Ana", is_guest: false },
      { id: "p-guest", display_name: "Gia", is_guest: true },
    ],
    askerBoards: ["b1"],
  };
}

describe("tags the firm must never see", () => {
  it("serves only the shared item, even to someone on the board", () => {
    const corpus = assembleFirmCorpus("org", rows());
    expect(corpus.items.map((item) => item.id)).toEqual(["shared"]);
    const served = JSON.stringify(corpus);
    for (const leaked of ["outreach", "fundraising", "market_sizing", "talent", "investor", TAG_CORRECTION_KEY]) expect(served, leaked).not.toContain(leaked);
  });

  it("keeps them out of the firm map built from that corpus", () => {
    const graph = assembleFirmGraph(assembleFirmCorpus("org", rows()));
    const thread = graph.threads.find((entry) => entry.id === "b1")!;
    expect(thread.situation).toBe("other");
    expect(thread.stops.filter((stop) => stop.kind === "method").map((stop) => (stop as { method: string }).method)).toEqual(["survey"]);
  });

  it("holds when the extractor has just written the tags on a private item's own meta", () => {
    const base = rows();
    const meta = mergeExtractedTags({}, validateExtractedTags({ method: ["outreach"], stage: "draft" }, { type: "document", carrier: false, shown: false, names: [] }), tagAskFor({ type: "document" }, false));
    expect(meta).toEqual({ method: ["outreach"], stage: "draft" });
    base.items = base.items.map((item) => (item.id === "private" ? { ...item, meta } : item));
    expect(JSON.stringify(assembleFirmCorpus("org", base))).not.toContain("outreach");
  });

  it("reads no new table to do it: tags ride on work_items.meta, which the reader already filters", () => {
    expect([...FIRM_CORPUS_TABLES].sort()).toEqual(["client_showings", "engagement_members", "engagements", "profiles", "work_item_extracts", "work_item_tasks", "work_items"]);
  });
});

describe("a lead's correction on shared work", () => {
  it("is what the firm reads, in place of what the model wrote", () => {
    const base = rows();
    base.items = base.items.map((item) =>
      item.id === "shared" ? { ...item, meta: { method: ["survey"], situation: "pricing", stage: "draft", [TAG_CORRECTION_KEY]: { method: ["workshop"], situation: "integration", stage: "reviewed" } } } : item,
    );
    const [shared] = assembleFirmCorpus("org", base).items;
    expect(shared).toMatchObject({ methods: ["workshop"], situation: "integration", stage: "reviewed" });
    // The correction's own bookkeeping (who, when) is never part of what is served.
    expect(JSON.stringify(shared)).not.toContain("p-ana\",\"at");
  });
});
