// 21 Nov 2026, chat pill Phase 1c part 2: the Proposals page's chat reads proposal work only, cut in code.
import { describe, expect, it } from "vitest";

import { PILL_COPY, PILL_HINTS, pillScope } from "@/lib/chat-pill-shared";
import { coverageLine, type FirmCorpus, type FirmItem } from "@/lib/firm-corpus-shared";
import { firmAskScope, isProposalWork, scopeCorpus, scopedCoverage } from "@/lib/firm-ask-shared";
import { runFirmAsk } from "@/lib/firm-ask.server";

const item = (id: string, boardId: string, over: Partial<FirmItem> = {}): FirmItem => ({
  id, boardId, type: "document", title: id, date: "2025-01-01", summary: `${id} summary`, decisions: null, entities: null, grade: "full", shown: [], sowFacts: null, kind: null, ...over,
});
const board = (id: string) => ({ id, title: `Board ${id}`, client: "Client", brief: `Brief of ${id}`, lead: null, startedOn: "2025-01-01", outcome: `The client cut scope on ${id} because the sponsor left.`, askerIsOnBoard: false });
const corpus: FirmCorpus = {
  orgId: "org",
  boards: [board("b1"), board("b2"), board("b3")],
  items: [
    item("sent-proposal", "b1", { kind: "proposal" }),
    item("readout", "b1", { type: "deck" }),
    item("sow", "b2", { sowFacts: { fee_text: "$90k" } }),
    item("draft", "b2", { proposalDraft: { gist: "Care model redesign" } }),
    item("call", "b3", { type: "call" }),
  ],
};

describe("what the Proposals chat reads", () => {
  it("proposal work is a sent proposal, a proposal draft or a statement of work, nothing else", () => {
    expect(corpus.items.filter(isProposalWork).map((i) => i.id)).toEqual(["sent-proposal", "sow", "draft"]);
  });
  it("the firm scope is the corpus as read; the proposals scope keeps only proposal work and the engagements holding it", () => {
    expect(scopeCorpus(corpus, "firm")).toBe(corpus);
    const scoped = scopeCorpus(corpus, "proposals");
    expect(scoped.items.map((i) => i.id)).toEqual(["sent-proposal", "sow", "draft"]);
    expect(scoped.boards.map((b) => b.id)).toEqual(["b1", "b2"]);
  });
  it("anything else coming in is read as the whole firm", () => {
    expect(firmAskScope("proposals")).toBe("proposals");
    for (const junk of ["board", "", null, undefined, 3, "PROPOSALS"]) expect(firmAskScope(junk)).toBe("firm");
  });
  it("the coverage line keeps the floor (no unshared names or counts), says proposals, and says some are not shared only when some are", () => {
    const scoped = scopeCorpus(corpus, "proposals");
    expect(scopedCoverage(scoped, "proposals", true)).toBe("Read the proposals in 2 engagements shared with the firm. Some engagements are not shared.");
    expect(scopedCoverage(scoped, "proposals", false)).toBe("Read the proposals in 2 engagements shared with the firm.");
    expect(scopedCoverage(corpus, "firm", true)).toBeNull();
    expect(coverageLine(corpus)).toContain("Some engagements are not shared.");
  });
  it("the model is never shown, and cannot cite, anything outside proposal work", async () => {
    const seen: string[] = [];
    const chat = async (messages: { content: string }[]) => {
      seen.push(messages.map((m) => m.content).join("\n"));
      return { text: JSON.stringify({ items: [{ id: "readout", why: "x" }, { id: "call", why: "x" }], boards: [] }), costUsd: 0, tokensIn: 0, tokensOut: 0 };
    };
    const { result } = await runFirmAsk({ chat: chat as never, loadText: async () => "text" }, { corpus: scopeCorpus(corpus, "proposals"), question: "How did we pitch care model work?", canSeeFees: false, meta: undefined });
    expect(seen.join("\n")).not.toContain("readout summary");
    expect(seen.join("\n")).not.toContain("call summary");
    expect(result.status).toBe("not_found");
    expect(result.claims).toEqual([]);
  });
  it("with no proposal work shared, it says nothing was found without calling a model", async () => {
    let calls = 0;
    const none = scopeCorpus({ ...corpus, items: corpus.items.filter((i) => !isProposalWork(i)) }, "proposals");
    const { result } = await runFirmAsk({ chat: (async () => { calls += 1; throw new Error("no"); }) as never, loadText: async () => null }, { corpus: none, question: "Any proposals on care models?", canSeeFees: false, meta: undefined });
    expect(calls).toBe(0);
    expect(result.status).toBe("not_found");
  });
});

describe("QA M1 of PR 307: an engagement's brief and close-out line stay out of the Proposals chat", () => {
  it("kept engagements lose their brief and close-out line; the firm scope keeps both", () => {
    for (const b of scopeCorpus(corpus, "proposals").boards) {
      expect(b.brief).toBeNull();
      expect(b.outcome).toBeNull();
    }
    expect(scopeCorpus(corpus, "firm").boards[0]!.outcome).toContain("sponsor left");
  });
  it("the model never sees them, and a close-out line it names cannot be read or cited", async () => {
    const seen: string[] = [];
    const chat = async (messages: { content: string }[], options: { tier?: string }) => {
      seen.push(messages.map((m) => m.content).join("\n"));
      if (options.tier === "fast") return { text: JSON.stringify({ items: [{ id: "outcome-b1", why: "x" }], boards: [] }), costUsd: 0, tokensIn: 0, tokensOut: 0 };
      return { text: JSON.stringify({ status: "answered", summary: "Scope was cut.", claims: [{ text: "The client cut scope because the sponsor left.", item_id: "outcome-b1", quote: "The client cut scope on b1 because the sponsor left." }] }), costUsd: 0, tokensIn: 0, tokensOut: 0 };
    };
    const { result } = await runFirmAsk({ chat: chat as never, loadText: async () => "text" }, { corpus: scopeCorpus(corpus, "proposals"), question: "Why did the care model work change?", canSeeFees: false, meta: undefined });
    const shown = seen.join("\n");
    expect(shown).not.toContain("sponsor left");
    expect(shown).not.toContain("outcome-b1");
    expect(shown).not.toContain("Brief of b1");
    expect(result.status).toBe("not_found");
    expect(result.claims).toEqual([]);
    expect(Object.keys(result.sources)).not.toContain("outcome-b1");
  });
});

describe("the pill on each page", () => {
  it("Proposals reads proposals; every other page off a board asks the whole firm", () => {
    expect(pillScope("proposals")).toBe("proposals");
    for (const place of ["home", "firm", "work", "other", "board"] as const) expect(pillScope(place)).toBe("firm");
  });
  it("each page has its own hint, and Proposals says what it reads", () => {
    expect(PILL_HINTS.proposals).toMatch(/proposals/);
    expect(PILL_HINTS.firm).toMatch(/firm/);
    expect(PILL_COPY.welcomeProposals).toMatch(/proposals and statements of work/);
    expect(PILL_COPY.lookingProposals).toMatch(/proposals shared with the firm/);
    for (const text of [...Object.values(PILL_HINTS), PILL_COPY.welcomeProposals, PILL_COPY.lookingProposals]) expect(text).not.toMatch(/—/);
  });
});
