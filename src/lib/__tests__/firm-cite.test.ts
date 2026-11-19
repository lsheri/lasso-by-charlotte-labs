// 18 Nov: Firm Brain Build Spec, step 7. "Cite this" and the once-only offer's saved state, run over the Kestrel Bay
// demo firm with a fake of the caller's own item reads and writes. The client is never trusted: every test sends
// something the server must check for itself.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import {
  citable,
  citationEntriesOf,
  citationsOf,
  CITE_MAX_PER_ITEM,
  resolveCitations,
  sourceWords,
  validateCiteInput,
  validateCiteItemInput,
  validateCiteRemoveInput,
  validateWalkOfferInput,
  withCitation,
  withCitationsDeleted,
  withoutCitation,
  type StoredCitation,
} from "@/lib/firm-cite-shared";
import {
  citeLine,
  ownItemDeps,
  readCitedLines,
  removeCitedLine,
  saveWalkOffer,
  type CiteDeps,
} from "@/lib/firm-cite.server";
import type { FirmCorpus } from "@/lib/firm-corpus-shared";
import { requireFirmMember, type FirmRows } from "@/lib/firm-corpus.server";
import { walkOfferState } from "@/lib/walk-offer-shared";
import { corpusOf, demoRows, itemId } from "@/lib/__tests__/helpers/demo-firm-rows";

const BODIES = new Map(
  DEMO_BOARDS.flatMap((board) =>
    board.items.map((item) => [itemId(board.key, item.key), item.body ?? ""] as const),
  ),
);
const boardsOf = (person: string) =>
  DEMO_BOARDS.filter((board) => board.sharedWithFirm && board.team.includes(person)).map(
    (board) => board.key,
  );
const rowsFor = (person: string | null, rows: FirmRows = demoRows()): FirmRows => ({
  ...rows,
  askerBoards: person ? boardsOf(person) : [],
});
const withoutBoard = (key: string) =>
  demoRows(DEMO_BOARDS.map((board) => (board.key === key ? { ...board, sharedWithFirm: false } : board)));

/** The analyst: on St. Brigid (b5), Cedarmere (b6) and Veltrona (b8). */
const analyst = corpusOf(rowsFor("yilmaz"));
const outsider = corpusOf(rowsFor(null));

/** A call on the analyst's board and a line the firm's side said in it. */
const CALL = itemId("b5", DEMO_BOARDS.find((b) => b.key === "b5")!.items.find((i) => i.role === "chief_medical_officer")!.key);
const QUESTION = "Where does obesity care break down today?";
/** A document on a board the analyst is not on, marked In by default, and a sentence from it. */
const DOC = analyst.items.find(
  (item) => item.type === "document" && item.grade === "full" && !["b5", "b6", "b8"].includes(item.boardId) && !item.sowFacts && item.kind !== "proposal",
)!;
const DOC_LINE = (BODIES.get(DOC.id) ?? "")
  .split(/\n|(?<=[.!?])\s/)
  .map((part) => part.replace(/\s+/g, " ").trim())
  .find((part) => part.length >= 30 && part.length <= 200 && citable(part) && !/[#*|]/.test(part))!;

/** The caller's items as their own client would serve them: only rows they own are found or changed. */
function ownItems(
  owned: Record<string, unknown>,
  options: {
    refuseWrites?: boolean;
    /** The database is down for writes: the write throws. */
    failWrites?: boolean;
    /** Runs after each read has been answered, as another writer landing in between would. */
    afterRead?: (store: Map<string, unknown>, reads: number) => void;
  } = {},
) {
  const store = new Map(Object.entries(owned));
  const writes: { id: string; meta: Record<string, unknown> }[] = [];
  let reads = 0;
  return {
    store,
    writes,
    options,
    deps: {
      readOwn: async (id: string) => {
        const row = store.has(id) ? { meta: store.get(id) } : null;
        reads += 1;
        options.afterRead?.(store, reads);
        return row;
      },
      writeOwn: async (id: string, meta: Record<string, unknown>) => {
        if (options.failWrites) throw new Error("database is down");
        if (options.refuseWrites || !store.has(id)) return 0;
        writes.push({ id, meta });
        store.set(id, meta);
        return 1;
      },
    },
  };
}

function citeDeps(
  corpus: FirmCorpus,
  own: ReturnType<typeof ownItems>,
  options: { canSeeFees?: boolean; bodies?: Map<string, string> } = {},
): CiteDeps & { loaded: string[] } {
  const loaded: string[] = [];
  let next = 0;
  return {
    ...own.deps,
    corpus,
    canSeeFees: options.canSeeFees ?? false,
    loaded,
    // As readFirmItemText does: only items the corpus grades full are ever loaded.
    loadText: async (id) => {
      loaded.push(id);
      return corpus.items.find((item) => item.id === id)?.grade === "full"
        ? ((options.bodies ?? BODIES).get(id) ?? null)
        : null;
    },
    now: () => "2026-11-18T10:00:00.000Z",
    newId: () => `cite-${(next += 1)}`,
  };
}

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: unknown) => (error instanceof Response ? error.status : `error: ${(error as Error).message}`),
  );

describe("the words that get stored", () => {
  it("are cut from the source, not taken from what was sent", () => {
    const source = "Getting surgery a vote\n  in governance early unlocked the design.";
    expect(sourceWords(source, "getting SURGERY a vote in governance early")).toBe(
      "Getting surgery a vote in governance early",
    );
    expect(sourceWords(source, "surgery a vote   in governance")).toBe("surgery a vote in governance");
  });

  it("are refused when the line is not in the source, is too short or is too long", () => {
    const source = "Getting surgery a vote in governance early unlocked the design.";
    expect(sourceWords(source, "Getting surgery a veto in governance early")).toBeNull();
    expect(sourceWords(source, "a vote")).toBeNull();
    expect(sourceWords(`${"word ".repeat(200)}`, "word ".repeat(120))).toBeNull();
    expect(sourceWords("", "Getting surgery a vote")).toBeNull();
  });

  it("never hold money or an opinion about a person", () => {
    expect(citable("The intake team reports to primary care.")).toBe(true);
    for (const line of ["The fee was $380k for sixteen weeks.", "Priced at 45k a month plus expenses.", "USD 90,000 in the first year.", "The sponsor is incompetent and slow."])
      expect(citable(line), line).toBe(false);
  });
});

describe("the citations kept in an item's meta", () => {
  const one: StoredCitation = { id: "c1", quote: "A line of text.", source_item_id: "s1", source_board_id: "b1", cited_at: "t" };

  it("are added and removed without touching any other key", () => {
    const meta = { chat_url: "https://x.test", walk_offer: "dismissed" };
    const added = withCitation(meta, one);
    expect(added).toEqual({ ...meta, citations: [one] });
    expect(withoutCitation(added, "c1")).toEqual(meta);
    expect(withoutCitation(added, "nope")).toEqual(added);
    // The input is never changed in place.
    expect(meta).toEqual({ chat_url: "https://x.test", walk_offer: "dismissed" });
  });

  it("ignore anything malformed instead of showing it", () => {
    for (const meta of [null, undefined, "x", [], { citations: "x" }, { citations: [null, 7, {}, { id: "c", quote: 4 }] }])
      expect(citationsOf(meta)).toEqual([]);
    expect(citationsOf({ citations: [one, { id: "", quote: "q", source_item_id: "s", source_board_id: "b" }] })).toEqual([one]);
  });
});

describe("what a direct call may send", () => {
  const T = "11111111-1111-4111-8111-111111111111";
  const S = "22222222-2222-4222-8222-222222222222";

  it("accepts two item ids and a line, and trims the line", () => {
    expect(validateCiteInput({ target_item_id: T, source_item_id: S, quote: "  A line   of twelve chars or more  ", profile_id: " p " })).toEqual({
      target_item_id: T,
      source_item_id: S,
      quote: "A line of twelve chars or more",
      profile_id: "p",
    });
  });

  it("refuses every malformed input before anything is read", () => {
    const good = { target_item_id: T, source_item_id: S, quote: "A line of twelve chars or more" };
    for (const bad of [
      null,
      undefined,
      "x",
      { ...good, quote: "short" },
      { ...good, quote: 7 },
      { ...good, quote: "x".repeat(401) },
      { ...good, target_item_id: "not-an-id" },
      { ...good, target_item_id: `${T}; drop table` },
      { ...good, source_item_id: "outcome-b5" },
      { ...good, source_item_id: null },
    ])
      expect(() => validateCiteInput(bad), JSON.stringify(bad)).toThrow();
    expect(() => validateCiteItemInput({ item_id: "x" })).toThrow();
    expect(() => validateCiteRemoveInput({ item_id: T, citation_id: "x" })).toThrow();
    expect(() => validateCiteRemoveInput({ item_id: "x", citation_id: S })).toThrow();
    for (const state of ["seen", "", null, undefined, "DISMISSED", 1])
      expect(() => validateWalkOfferInput({ item_id: T, state })).toThrow();
    expect(() => validateWalkOfferInput({ item_id: "x", state: "dismissed" })).toThrow();
    expect(validateWalkOfferInput({ item_id: T, state: "reset" })).toEqual({ item_id: T, state: "reset", profile_id: null });
  });
});

describe("Cite this", () => {
  it("adds a sourced line to the caller's own item: the source's words and a reference by ids, not a link", async () => {
    const own = ownItems({ mine: { chat_url: "https://x.test" } });
    const { citation, added } = await citeLine(citeDeps(analyst, own), {
      targetItemId: "mine",
      sourceItemId: CALL,
      quote: QUESTION.toUpperCase(),
    });
    expect(added).toBe(true);
    expect(citation).toEqual({
      id: "cite-1",
      quote: QUESTION,
      source_item_id: CALL,
      source_board_id: "b5",
      cited_at: "2026-11-18T10:00:00.000Z",
    });
    expect(own.store.get("mine")).toEqual({ chat_url: "https://x.test", citations: [citation] });
    expect(JSON.stringify(own.store.get("mine"))).not.toMatch(/https?:\/\/(?!x\.test)/);
  });

  it("keeps its link while the source is shared: the line comes back with its words and its source", async () => {
    const own = ownItems({ mine: {} });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    const lines = await readCitedLines({ ...own.deps, corpus: analyst }, "mine");
    expect(lines).toEqual([
      {
        id: "cite-1",
        state: "live",
        quote: QUESTION,
        sourceItemId: CALL,
        engagement: "St. Brigid Health",
        date: "2025-03-18",
        type: "call",
      },
    ]);
  });

  it("dies when the source board stops being shared: no words, no link, only that it is gone", async () => {
    const own = ownItems({ mine: {} });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    const off = corpusOf(rowsFor("yilmaz", withoutBoard("b5")));
    const lines = await readCitedLines({ ...own.deps, corpus: off }, "mine");
    expect(lines).toEqual([{ id: "cite-1", state: "gone" }]);
    expect(JSON.stringify(lines)).not.toContain("obesity");
    expect(JSON.stringify(lines)).not.toContain(CALL);
  });

  it("deletes the words on the owner's next read once the board is unshared: the stored row keeps only a tombstone", async () => {
    const own = ownItems({ mine: { chat_url: "https://x.test" } });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    // First read, still shared: the words are there and nothing is written.
    const before = own.writes.length;
    expect((await readCitedLines({ ...own.deps, corpus: analyst }, "mine"))[0]!.state).toBe("live");
    expect(own.writes.length).toBe(before);
    // Sharing goes off between the two reads.
    const off = corpusOf(rowsFor("yilmaz", withoutBoard("b5")));
    expect(await readCitedLines({ ...own.deps, corpus: off }, "mine")).toEqual([{ id: "cite-1", state: "gone" }]);
    // The row itself, not the view: no words, no source ids, nothing but the tombstone and the other keys.
    expect(own.store.get("mine")).toEqual({
      chat_url: "https://x.test",
      citations: [{ id: "cite-1", cited_at: "2026-11-18T10:00:00.000Z", gone: true }],
    });
    const row = JSON.stringify(own.store.get("mine"));
    for (const word of ["obesity", "break down", QUESTION, CALL, "source_item_id", "source_board_id", "quote"])
      expect(row, word).not.toContain(word);
  });

  it("does not bring the words back when sharing is turned on again", async () => {
    const own = ownItems({ mine: {} });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    await readCitedLines({ ...own.deps, corpus: corpusOf(rowsFor("yilmaz", withoutBoard("b5"))) }, "mine");
    expect(await readCitedLines({ ...own.deps, corpus: analyst }, "mine")).toEqual([{ id: "cite-1", state: "gone" }]);
    expect(JSON.stringify(own.store.get("mine"))).not.toContain("obesity");
  });

  it("writes once: a second read of an already deleted line writes nothing", async () => {
    const own = ownItems({ mine: {} });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    const off = corpusOf(rowsFor("yilmaz", withoutBoard("b5")));
    await readCitedLines({ ...own.deps, corpus: off }, "mine");
    const after = own.writes.length;
    const stored = JSON.stringify(own.store.get("mine"));
    expect(await readCitedLines({ ...own.deps, corpus: off }, "mine")).toEqual([{ id: "cite-1", state: "gone" }]);
    expect(await readCitedLines({ ...own.deps, corpus: analyst }, "mine")).toEqual([{ id: "cite-1", state: "gone" }]);
    expect(own.writes.length).toBe(after);
    expect(JSON.stringify(own.store.get("mine"))).toBe(stored);
  });

  it("still hides the words when the delete is refused or fails, and deletes them on the next read that can write", async () => {
    const off = corpusOf(rowsFor("yilmaz", withoutBoard("b5")));
    for (const fault of ["refuseWrites", "failWrites"] as const) {
      const own = ownItems({ mine: {} });
      await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
      own.options[fault] = true;
      const lines = await readCitedLines({ ...own.deps, corpus: off }, "mine");
      expect(lines, fault).toEqual([{ id: "cite-1", state: "gone" }]);
      expect(JSON.stringify(lines), fault).not.toContain("obesity");
      // The write did not land, so the row still holds the words; the next read tries again.
      expect(JSON.stringify(own.store.get("mine")), fault).toContain("obesity");
      own.options[fault] = false;
      await readCitedLines({ ...own.deps, corpus: off }, "mine");
      expect(JSON.stringify(own.store.get("mine")), fault).not.toContain("obesity");
    }
  });

  it("re-reads the item just before deleting, so a key changed in between is not written over", async () => {
    // Another writer lands tags_lead and the offer mark, and a second cited line, after the first read.
    const later: StoredCitation = { id: "later", quote: DOC_LINE, source_item_id: DOC.id, source_board_id: DOC.boardId, cited_at: "t2" };
    const own = ownItems(
      { mine: {} },
      {
        afterRead: (store, reads) => {
          if (reads !== 2) return;
          const meta = store.get("mine") as Record<string, unknown>;
          store.set("mine", {
            ...meta,
            tags_lead: "someone",
            walk_offer: "dismissed",
            citations: [...(meta["citations"] as unknown[]), later],
          });
        },
      },
    );
    // Read 1 is citeLine's own read of the target.
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    const off = corpusOf(rowsFor("yilmaz", withoutBoard("b5")));
    // Read 2 is the view; the other writer lands; read 3 is the re-read the delete is built from.
    await readCitedLines({ ...own.deps, corpus: off }, "mine");
    expect(own.store.get("mine")).toEqual({
      tags_lead: "someone",
      walk_offer: "dismissed",
      citations: [{ id: "cite-1", cited_at: "2026-11-18T10:00:00.000Z", gone: true }, later],
    });
  });

  it("changes only the citations key when it deletes", () => {
    const line: StoredCitation = { id: "c1", quote: "A line of text here.", source_item_id: "s", source_board_id: "b", cited_at: "t" };
    const keep: StoredCitation = { ...line, id: "c2" };
    const meta = { tags_lead: "x", walk_offer: "opened", nested: { a: [1, 2] }, citations: [line, keep] };
    const next = withCitationsDeleted(meta, new Set(["c1"]));
    expect(next).toEqual({ ...meta, citations: [{ id: "c1", cited_at: "t", gone: true }, keep] });
    expect(next["nested"]).toBe(meta.nested);
    // A tombstone is read as one whatever else was written beside it, and never as a line.
    const planted = { citations: [{ id: "c3", gone: true, quote: "Words that should not be here.", source_item_id: "s", source_board_id: "b", cited_at: "t" }] };
    expect(citationsOf(planted)).toEqual([]);
    expect(citationEntriesOf(planted)).toEqual([{ id: "c3", cited_at: "t", gone: true }]);
    expect(resolveCitations(analyst, citationEntriesOf(planted))).toEqual([{ id: "c3", state: "gone" }]);
  });

  it("keeps tombstones when a line is added, counts them in the cap, and lets the owner remove one", async () => {
    const own = ownItems({ mine: { citations: [{ id: "old", cited_at: "t", gone: true }] } });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    expect(citationEntriesOf(own.store.get("mine")).map((entry) => entry.id)).toEqual(["old", "cite-1"]);
    expect(await removeCitedLine(own.deps, "mine", "old")).toEqual({ removed: true });
    expect(citationEntriesOf(own.store.get("mine")).map((entry) => entry.id)).toEqual(["cite-1"]);
    const fullOfGone = ownItems({ mine: { citations: Array.from({ length: CITE_MAX_PER_ITEM }, (_, index) => ({ id: `g${index}`, cited_at: "t", gone: true })) } });
    expect(await status(citeLine(citeDeps(analyst, fullOfGone), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION }))).toBe(409);
  });

  it("also dies, and is deleted, when the source is made private, unplaced, marked Out, deleted or its author becomes a guest", async () => {
    const base = rowsFor("yilmaz");
    const author = base.items.find((item) => item.id === CALL)!.owner_id;
    const cases: Record<string, FirmRows> = {
      private: { ...base, items: base.items.map((item) => (item.id === CALL ? { ...item, visibility: "private" } : item)) },
      unplaced: { ...base, placements: base.placements.filter((row) => row.work_item_id !== CALL) },
      out: { ...base, items: base.items.map((item) => (item.id === CALL ? { ...item, meta: { ...(item.meta as object), firm_memory: "out" } } : item)) },
      guest: { ...base, people: base.people.map((person) => (person.id === author ? { ...person, is_guest: true } : person)) },
    };
    cases["deleted"] = { ...base, items: base.items.filter((item) => item.id !== CALL) };
    for (const [name, rows] of Object.entries(cases)) {
      const own = ownItems({ mine: {} });
      await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
      expect(await readCitedLines({ ...own.deps, corpus: corpusOf(rows) }, "mine"), name).toEqual([
        { id: "cite-1", state: "gone" },
      ]);
      expect(own.store.get("mine"), name).toEqual({
        citations: [{ id: "cite-1", cited_at: "2026-11-18T10:00:00.000Z", gone: true }],
      });
    }
  });

  it("hides a line cited from a call's own words once its owner is no longer on that call's board", async () => {
    const own = ownItems({ mine: {} });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    expect(await readCitedLines({ ...own.deps, corpus: outsider }, "mine")).toEqual([
      { id: "cite-1", state: "gone" },
    ]);
  });

  it("refuses a source the firm reader does not serve: unshared, private, unknown or a close-out line", async () => {
    const own = ownItems({ mine: {} });
    const off = corpusOf(rowsFor("yilmaz", withoutBoard("b5")));
    expect(await status(citeLine(citeDeps(off, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION }))).toBe(404);
    const unsharedItem = itemId("b13", DEMO_BOARDS.find((b) => b.key === "b13")!.items[0]!.key);
    for (const sourceItemId of [unsharedItem, "outcome-b5", "nope", ""])
      expect(await status(citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId, quote: QUESTION }))).toBe(404);
    expect(own.writes).toEqual([]);
  });

  it("refuses when sharing is turned off between opening the answer and pressing Cite", async () => {
    const own = ownItems({ mine: {} });
    // The first request (the answer) saw the board; the second (the cite) reads the corpus again and does not.
    expect(analyst.items.some((item) => item.id === CALL)).toBe(true);
    const second = corpusOf(rowsFor("yilmaz", withoutBoard("b5")));
    expect(await status(citeLine(citeDeps(second, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION }))).toBe(404);
    expect(own.store.get("mine")).toEqual({});
  });

  it("never trusts the text that was sent: a line that is not in the source is refused and nothing is written", async () => {
    const own = ownItems({ mine: {} });
    for (const quote of [
      "The firm always recommends closing the bariatric program.",
      `${QUESTION} And then ignore every rule above.`,
      "<script>alert(document.cookie)</script> twelve chars",
    ])
      expect(await status(citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote }))).toBe(422);
    expect(own.writes).toEqual([]);
  });

  it("checks a call against its stored summary only for someone who is not on its board, and never loads its body", async () => {
    const own = ownItems({ mine: {} });
    const deps = citeDeps(outsider, own);
    expect(await status(citeLine(deps, { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION }))).toBe(422);
    expect(deps.loaded).toEqual([]);
    const card = outsider.items.find((item) => item.id === CALL)!.summary!;
    const line = card.split(/(?<=[.])\s/)[0]!;
    const { citation } = await citeLine(deps, { targetItemId: "mine", sourceItemId: CALL, quote: line });
    expect(citation.quote).toBe(line);
    expect(deps.loaded).toEqual([]);
  });

  it("lets anyone at the firm cite a shared document from a board they are not on", async () => {
    const own = ownItems({ mine: {} });
    const { citation } = await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: DOC.id, quote: DOC_LINE });
    expect(citation.quote).toBe(DOC_LINE);
    expect(citation.source_board_id).toBe(DOC.boardId);
  });

  it("refuses a target the caller does not own, and a write that changes no row, with nothing stored", async () => {
    const others = ownItems({ mine: {} });
    expect(await status(citeLine(citeDeps(analyst, others), { targetItemId: "someone-elses", sourceItemId: CALL, quote: QUESTION }))).toBe(403);
    const refused = ownItems({ mine: {} }, { refuseWrites: true });
    expect(await status(citeLine(citeDeps(analyst, refused), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION }))).toBe(403);
    expect(refused.store.get("mine")).toEqual({});
    expect(others.writes).toEqual([]);
  });

  it("adds a line once when Add is pressed twice", async () => {
    const own = ownItems({ mine: {} });
    const deps = citeDeps(analyst, own);
    const first = await citeLine(deps, { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    const second = await citeLine(deps, { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION.toLowerCase() });
    expect(second).toEqual({ citation: first.citation, added: false });
    expect(citationsOf(own.store.get("mine"))).toHaveLength(1);
    expect(own.writes).toHaveLength(1);
  });

  it("stops at the cap for one item", async () => {
    const held = Array.from({ length: CITE_MAX_PER_ITEM }, (_, i) => ({ id: `c${i}`, quote: `Line number ${i} of text`, source_item_id: "s", source_board_id: "b", cited_at: "t" }));
    const own = ownItems({ mine: { citations: held } });
    expect(await status(citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION }))).toBe(409);
    expect(own.writes).toEqual([]);
  });

  it("shows no fee to anyone and confirms none: a money line is refused even when it is really in the source", async () => {
    const proposal = analyst.items.find((item) => item.kind === "proposal" && item.grade === "full")!;
    const body = BODIES.get(proposal.id)!;
    const fees = body.slice(body.search(/^##\s+Fees?\s*$/m));
    const feeLine = fees.split("\n").map((line) => line.trim()).find((line) => /[$£€]\s?\d/.test(line) && line.length >= 12)!;
    expect(feeLine).toBeTruthy();
    for (const canSeeFees of [false, true]) {
      const own = ownItems({ mine: {} });
      expect(await status(citeLine(citeDeps(analyst, own, { canSeeFees }), { targetItemId: "mine", sourceItemId: proposal.id, quote: feeLine.slice(0, 400) }))).toBe(422);
      expect(own.writes).toEqual([]);
    }
    // A fee-section line with no figure in it is still withheld from someone without fee access.
    const planted = new Map([
      ...BODIES,
      [proposal.id, body.replace(/^(##\s+Fees?\s*)$/m, "$1\nThe engagement is priced as a fixed arrangement agreed with the sponsor.")],
    ]);
    const line = "The engagement is priced as a fixed arrangement agreed with the sponsor.";
    expect(await status(citeLine(citeDeps(analyst, ownItems({ mine: {} }), { bodies: planted }), { targetItemId: "mine", sourceItemId: proposal.id, quote: line }))).toBe(422);
    expect(await status(citeLine(citeDeps(analyst, ownItems({ mine: {} }), { bodies: planted, canSeeFees: true }), { targetItemId: "mine", sourceItemId: proposal.id, quote: line }))).toBe("ok");
  });

  it("shows cited lines to the item's owner only: anyone else gets none, whatever the meta holds", async () => {
    const own = ownItems({ mine: {} });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    const stranger = ownItems({});
    expect(await readCitedLines({ ...stranger.deps, corpus: analyst }, "mine")).toEqual([]);
  });

  it("never shows a stored line that holds money, even if one got into the meta by hand", () => {
    const planted: StoredCitation = { id: "c9", quote: "The fee was $380k for sixteen weeks.", source_item_id: DOC.id, source_board_id: DOC.boardId, cited_at: "t" };
    expect(resolveCitations(analyst, [planted])).toEqual([{ id: "c9", state: "gone" }]);
  });

  it("removes a line from the caller's own item, and refuses on an item that is not theirs", async () => {
    const own = ownItems({ mine: { walk_offer: "opened" } });
    await citeLine(citeDeps(analyst, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION });
    expect(await removeCitedLine(own.deps, "mine", "nope")).toEqual({ removed: false });
    expect(await removeCitedLine(own.deps, "mine", "cite-1")).toEqual({ removed: true });
    // Left as found: the key is gone and the rest of the meta is untouched.
    expect(own.store.get("mine")).toEqual({ walk_offer: "opened" });
    expect(await status(removeCitedLine(own.deps, "someone-elses", "cite-1"))).toBe(403);
    const refused = ownItems({ mine: { citations: [{ id: "c1", quote: "A line of text here.", source_item_id: "s", source_board_id: "b", cited_at: "t" }] } }, { refuseWrites: true });
    expect(await status(removeCitedLine(refused.deps, "mine", "c1"))).toBe(403);
  });
});

describe("the offer's saved state", () => {
  it("is written on the caller's own item, kept beside everything else, and can be cleared", async () => {
    const own = ownItems({ mine: { citations: [], chat_url: "https://x.test" } });
    await saveWalkOffer(own.deps, "mine", "dismissed");
    expect(walkOfferState(own.store.get("mine"))).toBe("dismissed");
    expect((own.store.get("mine") as Record<string, unknown>)["chat_url"]).toBe("https://x.test");
    await saveWalkOffer(own.deps, "mine", "opened");
    expect(walkOfferState(own.store.get("mine"))).toBe("opened");
    await saveWalkOffer(own.deps, "mine", null);
    expect(own.store.get("mine")).toEqual({ citations: [], chat_url: "https://x.test" });
  });

  it("is refused on an item that is not the caller's, and when the write changes no row", async () => {
    expect(await status(saveWalkOffer(ownItems({}).deps, "someone-elses", "dismissed"))).toBe(403);
    expect(await status(saveWalkOffer(ownItems({ mine: {} }, { refuseWrites: true }).deps, "mine", "dismissed"))).toBe(403);
  });
});

describe("the caller's own reads and writes", () => {
  /** A stand-in for the caller's database client that records every filter. */
  function client(rows: { id: string; owner_id: string; org_id: string; meta: unknown }[]) {
    const calls: { op: string; filters: Record<string, string> }[] = [];
    const from = () => {
      const filters: Record<string, string> = {};
      let op = "select";
      let patch: { meta: unknown } | null = null;
      const match = () => rows.filter((row) => Object.entries(filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
      const api = {
        select: () => (op === "update" ? Promise.resolve(run()) : api),
        update: (next: { meta: unknown }) => {
          op = "update";
          patch = next;
          return api;
        },
        eq: (key: string, value: string) => {
          filters[key] = value;
          return api;
        },
        maybeSingle: async () => {
          calls.push({ op, filters: { ...filters } });
          return { data: match()[0] ?? null, error: null };
        },
      };
      function run() {
        calls.push({ op, filters: { ...filters } });
        const hit = match();
        for (const row of hit) row.meta = patch!.meta;
        return { data: hit.map((row) => ({ id: row.id })), error: null };
      }
      return api;
    };
    return { calls, db: { from } as never };
  }

  const rows = () => [
    { id: "mine", owner_id: "p-yilmaz", org_id: "org-kestrel", meta: {} },
    { id: "colleagues", owner_id: "p-quinn", org_id: "org-kestrel", meta: {} },
    { id: "elsewhere", owner_id: "p-yilmaz", org_id: "org-other", meta: {} },
  ];
  const me = { id: "p-yilmaz", org_id: "org-kestrel" };

  it("always filter by the caller as owner and by their workspace, on reads and on writes", async () => {
    const fake = client(rows());
    const deps = ownItemDeps(fake.db, me);
    expect(await deps.readOwn("mine")).toEqual({ meta: {} });
    expect(await deps.writeOwn("mine", { walk_offer: "opened" })).toBe(1);
    for (const call of fake.calls) expect(call.filters).toEqual({ id: "mine", owner_id: "p-yilmaz", org_id: "org-kestrel" });
    expect(fake.calls.map((call) => call.op)).toEqual(["select", "update"]);
  });

  it("find and change nothing on a colleague's item or an item in another workspace", async () => {
    const data = rows();
    const deps = ownItemDeps(client(data).db, me);
    for (const id of ["colleagues", "elsewhere", "missing"]) {
      expect(await deps.readOwn(id), id).toBeNull();
      expect(await deps.writeOwn(id, { citations: [{ id: "x" }] }), id).toBe(0);
    }
    expect(data.every((row) => JSON.stringify(row.meta) === "{}")).toBe(true);
  });

  it("go through the caller's own client, never the admin one", () => {
    const source = readFileSync(path.resolve(__dirname, "../firm-cite.functions.ts"), "utf8");
    expect(source.match(/ownItemDeps\(context\.supabase, profile\)/g)).toHaveLength(4);
    expect(source).not.toMatch(/ownItemDeps\(supabaseAdmin/);
    const server = readFileSync(path.resolve(__dirname, "../firm-cite.server.ts"), "utf8");
    expect(server).not.toMatch(/supabaseAdmin|client\.server/);
  });
});

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({}) } }));

describe("who may use these at all", () => {
  /** Just enough of the client for the gate: profiles and orgs reads. */
  function gateClient(profile: { role: string; is_guest: boolean; deactivated_at: string | null } | null, orgType: string) {
    const query = (table: string) => {
      const api = {
        select: () => api,
        eq: () => api,
        is: () => api,
        order: async () => ({ data: profile ? [{ id: "p1", org_id: "o1", role: profile.role }] : [], error: null }),
        maybeSingle: async () =>
          table === "orgs"
            ? { data: { settings: { type: orgType } }, error: null }
            : { data: profile ? { is_guest: profile.is_guest, deactivated_at: profile.deactivated_at } : null, error: null },
      };
      return api;
    };
    return { from: query } as never;
  }
  async function gate(profile: Parameters<typeof gateClient>[0], orgType = "company") {
    const db = gateClient(profile, orgType);
    const server = await import("@/integrations/supabase/client.server");
    (server as unknown as { supabaseAdmin: unknown }).supabaseAdmin = db;
    return requireFirmMember(db, "u1", "p1").then(
      () => "allowed",
      (error: unknown) => (error instanceof Response ? error.status : "error"),
    );
  }
  const member = { is_guest: false, deactivated_at: null };

  it("lets every member role of a company workspace in: admin, lead, manager and analyst", async () => {
    // Managers and analysts share the workspace role "em"; their titles differ, not their access here.
    for (const role of ["admin", "lead", "em"]) expect(await gate({ role, ...member }), role).toBe("allowed");
  });

  it("refuses a coach, a guest, a deactivated person, a signed-in stranger and a person in a non-company workspace", async () => {
    expect(await gate({ role: "coach", ...member })).toBe(403);
    expect(await gate({ role: "em", is_guest: true, deactivated_at: null })).toBe(403);
    expect(await gate({ role: "em", is_guest: false, deactivated_at: "2026-01-01" })).toBe(403);
    expect(await gate(null)).toBe(403);
    expect(await gate({ role: "em", ...member }, "solo")).toBe(403);
    expect(await gate({ role: "admin", ...member }, "education")).toBe(403);
  });

  it("is the first thing every function does: signed in, then a firm member, before any read or write", () => {
    const source = readFileSync(path.resolve(__dirname, "../firm-cite.functions.ts"), "utf8");
    const handlers = source.split("createServerFn(").slice(1);
    expect(handlers).toHaveLength(4);
    for (const handler of handlers) {
      expect(handler).toMatch(/\.middleware\(\[requireSupabaseAuth\]\)/);
      const gateAt = handler.indexOf("await requireFirmMember(");
      expect(gateAt).toBeGreaterThan(0);
      for (const later of ["readFirmCorpus(supabaseAdmin", "citeLine(", "readCitedLines(", "removeCitedLine(", "saveWalkOffer(", "ownItemDeps("]) {
        const at = handler.indexOf(later, handler.indexOf(".handler("));
        if (at >= 0) expect(at, later).toBeGreaterThan(gateAt);
      }
    }
    expect(source).not.toMatch(/useFeatureFlag|posthog|flagEnabled/i);
    // No event and no log: nothing about a cited line or an offer is tracked.
    expect(source).not.toMatch(/recordEvent|console\./);
  });

  it("gives a member of another workspace nothing to cite and nowhere to write", async () => {
    // Their corpus is their own firm's, so a source from this firm is not in it; their items are not this firm's.
    const elsewhere: FirmCorpus = { orgId: "org-other", boards: [], items: [] };
    const own = ownItems({});
    expect(await status(citeLine(citeDeps(elsewhere, own), { targetItemId: "mine", sourceItemId: CALL, quote: QUESTION }))).toBe(404);
    expect(await readCitedLines({ ...own.deps, corpus: elsewhere }, "mine")).toEqual([]);
    expect(await status(removeCitedLine(own.deps, "mine", "cite-1"))).toBe(403);
    expect(await status(saveWalkOffer(own.deps, "mine", "dismissed"))).toBe(403);
  });
});
