// 17 Nov: Start a proposal, step 2 (firm-brain-review RECOMMENDATION section 4, "Draft form"). Sections open as
// "Draft, not reviewed"; the fee is always for partner decision and the team is role slots; the model never reads
// another client's name or a fee; a section that still names one after one redraft becomes a gap; quotes must be
// verbatim and figures must be in a source or the notes; questions are three to six, closed, with defaults.
import { describe, expect, it } from "vitest";

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import type { FirmCorpus } from "@/lib/firm-corpus-shared";
import {
  checkFigures,
  draftStatus,
  FEE_LINE,
  forbiddenNames,
  GAP_LINE,
  maskNames,
  parseDraft,
  questionsText,
  recheckSources,
  renderProposalMarkdown,
  storedDraft,
  teamSlots,
  type DraftContext,
} from "@/lib/proposal-draft-shared";
import { runProposalDraft } from "@/lib/proposal-draft.server";
import { emptyBrief } from "@/lib/proposal-shared";

const corpus: FirmCorpus = {
  orgId: "org",
  boards: [
    { id: "b5", title: "Comprehensive weight management service line", client: "St. Brigid Health", brief: "Design a service line.", lead: "Tiago", startedOn: "2025-03-03", outcome: "Ran to plan. Client extended. The employer bundle needed CFO time two weeks sooner than planned.", askerIsOnBoard: false },
    { id: "b6", title: "Integrated behavioral health service line", client: "Cedarmere", brief: "Primary care.", lead: "Mei", startedOn: "2024-05-06", outcome: "Overran. Client extended. Start payer conversations alongside the diagnostic.", askerIsOnBoard: false },
  ],
  items: [
    { id: "sow5", boardId: "b5", type: "document", title: "SOW: St. Brigid Health", date: "2025-02-24", summary: "Signed 16-week SOW.", decisions: null, entities: "St. Brigid Health, Dana Whitfield, VP Strategy, CFO, GLP-1", grade: "full", shown: [], sowFacts: { fee_text: "$380k", fee_basis: "fixed", weeks: 16 }, kind: null },
    { id: "prop5", boardId: "b5", type: "document", title: "Proposal: St. Brigid", date: "2025-02-17", summary: "Proposal.", decisions: null, entities: null, grade: "full", shown: [{ on: "2025-02-18", occasion: "Sent" }], sowFacts: null, kind: "proposal" },
    { id: "sow6", boardId: "b6", type: "document", title: "SOW", date: "2024-04-29", summary: "Signed 14-week SOW.", decisions: null, entities: "Cedarmere, primary care", grade: "full", shown: [], sowFacts: { fee_text: "$340k", fee_basis: "fixed", weeks: 14 }, kind: null },
  ],
};

const TEXT: Record<string, string> = {
  sow5: "Statement of work for St. Brigid Health. Sponsor Dana Whitfield.\nPhase 1: Diagnostic over 6 weeks with 20 to 25 interviews.\n## Fees\n$380k fixed.\n## Team\nLead.",
  prop5: "# Proposal\nWe propose a 16 week program for St. Brigid.\n## Fees\n$380,000.\n## Approach\nDiagnostic, design, launch.",
  sow6: "Statement of work for Cedarmere. 14 weeks. Payer conversations start in week 3.",
};
const read = async (itemId: string) => TEXT[itemId] ?? null;
const intake = "Harbor Valley Health wants a weight management service line by June. The CFO decides. 12 weeks.";

function reply(text: string): ChatResult {
  return { text, toolArgs: null, toolCalls: [], finishReason: "stop", model: "fake", tokensIn: 10, tokensOut: 10, cachedIn: 0, costUsd: 0.01, durationMs: 1 };
}

function fakeChat(replies: { draft: object; redraft?: object; facts?: object }) {
  const seen: { messages: ChatMessage[]; options: ChatOptions }[] = [];
  return {
    seen,
    chat: async (messages: ChatMessage[], options: ChatOptions) => {
      seen.push({ messages, options });
      const surface = options.meta?.surface;
      if (surface === "proposal_redraft") return reply(JSON.stringify(replies.redraft ?? { sections: {} }));
      if (surface === "proposal_new_facts") return reply(JSON.stringify(replies.facts ?? { sentences: [] }));
      return reply(JSON.stringify(replies.draft));
    },
  };
}

const meta = { surface: "proposal_draft", orgId: "org", profileId: "p", userId: "u" } as unknown as ChatOptions["meta"];

const goodDraft = {
  sections: {
    context: { body: "The client wants a weight management service line by June.", sources: [{ item_id: "own1", quote: "wants a weight management service line by June" }] },
    objectives: { body: "Decide whether to build the service line.", sources: [] },
    approach: { body: "Phase 1: Diagnostic\n- 20 to 25 interviews\nPhase 2: Design", sources: [{ board_id: "b5" }, { item_id: "sow5", quote: "Phase 1: Diagnostic over 6 weeks with 20 to 25 interviews." }] },
    workstreams: { body: "Clinical model; payer strategy.", sources: [{ board_id: "b6" }] },
    deliverables: { body: "", gap: true },
    timeline: { body: "12 weeks.", sources: [] },
    assumptions: { body: "Payer conversations start alongside the diagnostic.", sources: [{ board_id: "b6" }] },
  },
  team_roles: ["Engagement lead", "Clinical advisor", "Dana Whitfield"],
  questions: [
    { question: "Interview count?", default: "20 to 25, as on a past engagement" },
    { question: "Add CFO time in week 2 to assumptions?", default: "Yes" },
    { question: "Phase count?", default: "Two" },
  ],
};

describe("other clients' names", () => {
  it("are found from precedent clients and the proper names in their index cards, never roles or acronyms", () => {
    const terms = forbiddenNames(corpus, ["b5", "b6"], intake).map((entry) => entry.term);
    expect(terms).toEqual(expect.arrayContaining(["St. Brigid Health", "Dana Whitfield", "Cedarmere"]));
    expect(terms).not.toContain("CFO");
    expect(terms).not.toContain("GLP-1");
    expect(terms).not.toContain("VP Strategy");
  });

  it("are masked whole, client first", () => {
    const terms = forbiddenNames(corpus, ["b5", "b6"], intake);
    expect(maskNames("St. Brigid Health and Cedarmere's team met Dana Whitfield.", terms)).toBe("[CLIENT A] and [CLIENT B] team met [NAME].");
  });

  it("are not masked when the new client's own notes use the term", () => {
    expect(forbiddenNames(corpus, ["b6"], "Cedarmere is the new client.").map((entry) => entry.term)).not.toContain("Cedarmere");
  });
});

describe("figures", () => {
  it("stay when a source or the notes state them, and are removed otherwise", () => {
    expect(checkFigures("A 12 week program.", [intake])).toEqual({ text: "A 12 week program.", removed: 0 });
    expect(checkFigures("A 20 week program costing $200k.", [intake])).toEqual({ text: "A [figure removed] program costing [figure removed].", removed: 2 });
  });
});

describe("parsing the draft", () => {
  const ctx: DraftContext = {
    precedents: [{ boardId: "b5", title: "Weight management" }, { boardId: "b6", title: "Behavioral health" }],
    quotable: new Map([
      ["own1", { title: "Intake call", text: intake }],
      ["sow5", { title: "SOW", text: TEXT["sow5"]! }],
    ]),
    intake,
    terms: forbiddenNames(corpus, ["b5", "b6"], intake),
  };

  it("writes the fee and team itself, keeps verbatim quotes and marks gaps", () => {
    const { sections, questions } = parseDraft(goodDraft, ctx);
    expect(sections.map((section) => section.key)).toEqual(["context", "objectives", "approach", "workstreams", "deliverables", "timeline", "assumptions", "fee", "team"]);
    expect(sections.every((section) => section.status !== "confirmed")).toBe(true);
    expect(sections.find((section) => section.key === "fee")!.body).toBe(FEE_LINE);
    const team = sections.find((section) => section.key === "team")!.body;
    expect(team).toContain("- Engagement lead: to be staffed");
    expect(team).not.toContain("Dana");
    expect(sections.find((section) => section.key === "deliverables")).toMatchObject({ status: "gap", body: GAP_LINE });
    expect(sections.find((section) => section.key === "approach")!.sources.map((source) => source.kind)).toEqual(["structure", "fact"]);
    expect(questions).toHaveLength(3);
  });

  it("drops a quote that is not really in its item, and a source board that is not a precedent", () => {
    const { sections } = parseDraft({ sections: { context: { body: "The client is large.", sources: [{ item_id: "own1", quote: "the client has ten hospitals and a big budget" }, { board_id: "b99" }] } } }, ctx);
    expect(sections[0]!.sources).toEqual([]);
  });

  it("keeps at most six questions, each with a default and no other client's name", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ question: `Question ${index}?`, default: "Yes" }));
    expect(parseDraft({ questions: [...many, { question: "Same as Cedarmere?", default: "Yes" }, { question: "No default?" }] }, ctx).questions).toHaveLength(6);
    expect(parseDraft({ questions: [{ question: "Same as Cedarmere?", default: "Yes" }, { question: "No default?" }] }, ctx).questions).toEqual([]);
  });

  it("always reads the team as role slots", () => {
    expect(teamSlots([], [])).toContain("Engagement lead");
    expect(teamSlots(["Dr. Smith, cardiologist"], [])).not.toContain("Smith");
  });
});

describe("drafting", () => {
  const ownItems = new Map([["own1", { title: "Intake call", text: intake }]]);

  it("never shows the model a fee or another client's name, and fences the new client last", async () => {
    const model = fakeChat({ draft: goodDraft });
    await runProposalDraft(model.chat, { corpus, precedentIds: ["b5", "b6"], intake, brief: emptyBrief(), ownItems, read, meta });
    const sent = model.seen[0]!.messages.map((message) => message.content).join("\n");
    expect(sent).not.toMatch(/\$\s?\d/);
    expect(sent).not.toContain("St. Brigid");
    expect(sent).not.toContain("Cedarmere");
    expect(sent).not.toContain("Dana Whitfield");
    expect(sent).toContain("[CLIENT A]");
    expect(sent.indexOf("=== NEW CLIENT")).toBeGreaterThan(sent.indexOf("PRECEDENT B"));
    expect(model.seen[0]!.options.tier).toBe("smart");
  });

  it("passes the name check, counts figures and lists the questions", async () => {
    const model = fakeChat({ draft: goodDraft });
    const { draft, usage } = await runProposalDraft(model.chat, { corpus, precedentIds: ["b5", "b6"], intake, brief: emptyBrief(), ownItems, read, meta });
    expect(draft.checks).toEqual({ names: "passed", blocked: 0, figuresRemoved: 0, newFacts: 0 });
    expect(draft.precedentIds).toEqual(["b5", "b6"]);
    expect(usage.calls).toBe(2);
  });

  it("redrafts a section that names another client once, and leaves it a gap if it still does", async () => {
    const leaky = { ...goodDraft, sections: { ...goodDraft.sections, objectives: { body: "Repeat what Cedarmere did." }, timeline: { body: "As at St. Brigid Health." } } };
    const model = fakeChat({ draft: leaky, redraft: { sections: { objectives: { body: "Repeat what worked before." }, timeline: { body: "Still St. Brigid Health." } } } });
    const { draft } = await runProposalDraft(model.chat, { corpus, precedentIds: ["b5", "b6"], intake, brief: emptyBrief(), ownItems, read, meta });
    expect(draft.sections.find((section) => section.key === "objectives")).toMatchObject({ status: "draft", body: "Repeat what worked before." });
    expect(draft.sections.find((section) => section.key === "timeline")).toMatchObject({ status: "gap" });
    expect(draft.checks).toMatchObject({ names: "blocked", blocked: 1 });
    expect(JSON.stringify(draft)).not.toContain("Cedarmere");
  });

  it("marks sentences about the new client that the notes do not state", async () => {
    const model = fakeChat({ draft: goodDraft, facts: { sentences: ["Decide whether to build the service line."] } });
    const { draft } = await runProposalDraft(model.chat, { corpus, precedentIds: ["b5"], intake, brief: emptyBrief(), ownItems, read, meta });
    expect(draft.checks.newFacts).toBe(1);
    expect(draft.sections.find((section) => section.key === "objectives")!.flags[0]).toContain("Not in the notes");
  });
});

describe("the saved card", () => {
  const ctx: DraftContext = { precedents: [{ boardId: "b5", title: "Weight management" }], quotable: new Map([["sow5", { title: "SOW", text: TEXT["sow5"]! }]]), intake, terms: [] };
  const { sections, questions } = parseDraft(goodDraft, ctx);
  const draft = { sections, questions, checks: { names: "passed" as const, blocked: 0, figuresRemoved: 0, newFacts: 0 }, precedentIds: ["b5"], createdAt: "2026-11-17T12:00:00Z" };

  it("keeps the fee under its own heading and marks every section", () => {
    const body = renderProposalMarkdown("Proposal draft: Harbor Valley", draft);
    expect(body).toContain("## Fees\n_Draft, not reviewed_\n\nFee: for partner decision.");
    expect(body).toContain("_Gap_");
    expect(body).toContain("## Questions for the lead");
    expect(body).not.toMatch(/—/);
  });

  it("is never ready: the fee is the partner's", () => {
    const allConfirmed = { ...draft, sections: draft.sections.map((section) => ({ ...section, status: "confirmed" as const })) };
    expect(draftStatus(allConfirmed)).toEqual({ unconfirmed: 0, questions: 3, feeSet: false, ready: false });
  });

  it("copies the questions with their defaults", () => {
    expect(questionsText(questions).split("\n")[0]).toBe("1. Interview count? (Default: 20 to 25, as on a past engagement)");
  });

  it("hides a quote whose board is no longer shared, keeping the text", () => {
    const stored = storedDraft({ proposal_draft: draft })!;
    const rechecked = recheckSources(stored, new Set());
    const approach = rechecked.sections.find((section) => section.key === "approach")!;
    expect(approach.sources.find((source) => source.kind === "fact")).toMatchObject({ shared: false, quote: "" });
    expect(approach.body).toBe(draft.sections.find((section) => section.key === "approach")!.body);
  });
});
