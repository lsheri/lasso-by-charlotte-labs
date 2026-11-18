// 17 Nov: Start a proposal, step 1 (firm-brain-review RECOMMENDATION section 4). Precedents are close or loose and
// never padded; each carries its lesson; past fees are a list for admins and leads only, never a range, with fixed
// and monthly fees apart; the model never reads a fee.
import { describe, expect, it } from "vitest";

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import type { FirmCorpus } from "@/lib/firm-corpus-shared";
import { buildPickMessages, draftBrief, pickPrecedents } from "@/lib/proposal-precedents.server";
import { checkPicks, cleanBrief, goodProposals, parseOutcome, pastFees, precedentView } from "@/lib/proposal-shared";

const corpus: FirmCorpus = {
  orgId: "org",
  boards: [
    { id: "b5", title: "Comprehensive weight management service line", client: "St. Brigid Health", brief: "Design a service line. $380,000.", lead: "Tiago", startedOn: "2025-03-03", outcome: "Ran to plan. Client extended. Getting surgery a vote early unlocked the design; the employer bundle needed CFO time two weeks sooner than planned.", askerIsOnBoard: false },
    { id: "b6", title: "Integrated behavioral health service line", client: "Cedarmere", brief: "Primary care.", lead: "Mei", startedOn: "2024-05-06", outcome: "Overran. Client extended. Start payer conversations alongside the diagnostic.", askerIsOnBoard: false },
    { id: "b7", title: "Cardiometabolic service line opportunity", client: "Willowmere", brief: "Size it.", lead: "Mei", startedOn: "2026-11-02", outcome: null, askerIsOnBoard: false },
    { id: "b12", title: "Embedded strategy team", client: "Orbiton", brief: "Retainer.", lead: "Ana", startedOn: "2025-01-06", outcome: "Ran to plan. Not extended. Monthly check-ins kept scope honest.", askerIsOnBoard: false },
  ],
  items: [
    { id: "sow5", boardId: "b5", type: "document", title: "SOW", date: "2025-02-24", summary: "Signed 16-week, $380k fixed-fee SOW.", decisions: null, entities: null, grade: "full", shown: [], sowFacts: { fee_text: "$380k", fee_amount: 380000, fee_basis: "fixed", weeks: 16 }, kind: null },
    { id: "prop5", boardId: "b5", type: "document", title: "Proposal: St. Brigid", date: "2025-02-17", summary: "Proposal.", decisions: null, entities: null, grade: "full", shown: [{ on: "2025-02-18", occasion: "Sent" }], sowFacts: null, kind: "proposal" },
    { id: "sow6", boardId: "b6", type: "document", title: "SOW", date: "2024-04-29", summary: "Signed 14-week SOW.", decisions: null, entities: null, grade: "full", shown: [], sowFacts: { fee_text: "$340k", fee_amount: 340000, fee_basis: "fixed", weeks: 14 }, kind: null },
    { id: "prop6", boardId: "b6", type: "document", title: "Proposal: Cedarmere", date: "2024-04-22", summary: "Proposal.", decisions: null, entities: null, grade: "full", shown: [{ on: "2024-04-23", occasion: "Sent" }], sowFacts: null, kind: "proposal" },
    { id: "sow7", boardId: "b7", type: "document", title: "SOW", date: "2026-10-28", summary: "4-week assessment.", decisions: null, entities: null, grade: "full", shown: [], sowFacts: { fee_text: "$90k", fee_amount: 90000, fee_basis: "fixed", weeks: 4 }, kind: null },
    { id: "sow12", boardId: "b12", type: "document", title: "SOW", date: "2025-01-02", summary: "Monthly retainer.", decisions: null, entities: null, grade: "full", shown: [], sowFacts: { fee_text: "$45k/month", fee_amount: 45000, fee_basis: "monthly", weeks: 26 }, kind: null },
  ],
};

describe("the close-out line", () => {
  it("reads plan, extension and lesson", () => {
    expect(parseOutcome("Overran. Client extended. Start payer conversations alongside the diagnostic.")).toEqual({
      ranToPlan: false,
      extended: true,
      lesson: "Start payer conversations alongside the diagnostic.",
    });
    expect(parseOutcome("Free text from a real board.")).toEqual({ ranToPlan: null, extended: null, lesson: "Free text from a real board." });
    expect(parseOutcome(null).lesson).toBeNull();
  });
});

describe("precedents", () => {
  it("show scope, length, how it went and the lesson, with money masked", () => {
    const view = precedentView(corpus, { boardId: "b6", closeness: "close", why: "Same kind of service line" })!;
    expect(view).toMatchObject({ closeness: "close", weeks: 14, ranToPlan: false, extended: true, lesson: "Start payer conversations alongside the diagnostic.", sowItemId: "sow6", active: false });
    expect(precedentView(corpus, { boardId: "b5", closeness: "close", why: "" })!.scope).toBe("Signed 16-week, [fee] fixed-fee SOW.");
    expect(precedentView(corpus, { boardId: "b7", closeness: "loose", why: "" })!.active).toBe(true);
  });

  it("keep only known boards, at most three, close first, never repeated", () => {
    const picks = checkPicks(
      [
        { board_id: "b7", closeness: "loose", why: "Related" },
        { board_id: "b5", closeness: "close", why: "Same work" },
        { board_id: "b5", closeness: "close", why: "Again" },
        { board_id: "b13-unshared", closeness: "close", why: "Not readable" },
        { board_id: "b6", closeness: "close", why: "Same work" },
        { board_id: "b12", closeness: "loose", why: "Fourth" },
      ],
      corpus,
    );
    expect(picks.map((pick) => pick.boardId)).toEqual(["b5", "b6", "b7"]);
    expect(picks.map((pick) => pick.closeness)).toEqual(["close", "close", "loose"]);
  });
});

describe("what good looks like", () => {
  it("lists the firm's client-shown proposals, newest first", () => {
    expect(goodProposals(corpus).map((proposal) => proposal.itemId)).toEqual(["prop5", "prop6"]);
  });
});

describe("past fees", () => {
  it("are a list as written in each SOW, never a range, with monthly fees apart", () => {
    const fees = pastFees(corpus, ["b5", "b6", "b7", "b12"], true);
    expect(fees.fixed.map((row) => row.fee)).toEqual(["$380k", "$340k", "$90k"]);
    expect(fees.monthly.map((row) => row.fee)).toEqual(["$45k/month"]);
    expect(JSON.stringify(fees)).not.toMatch(/\$90k\s*(to|-)\s*\$380k/);
  });

  it("are empty for anyone without fee access", () => {
    expect(pastFees(corpus, ["b5", "b6"], false)).toEqual({ fixed: [], monthly: [] });
  });
});

function reply(text: string): ChatResult {
  return { text, toolArgs: null, toolCalls: [], finishReason: "stop", model: "fake", tokensIn: 1, tokensOut: 1, cachedIn: 0, costUsd: 0, durationMs: 1 };
}

describe("the model calls", () => {
  it("fill the brief from notes, keeping each field short and masking money", async () => {
    const seen: ChatMessage[][] = [];
    const chat = async (messages: ChatMessage[], _options: ChatOptions) => (
      seen.push(messages),
      reply(JSON.stringify({ client: "regional health system", problem: "Prevent diabetes", deadline: "April board", decider: "Chief Strategy Officer", size: "Budget about $250k", outOfScope: "" }))
    );
    const brief = await draftBrief(chat, "notes", undefined);
    expect(brief.size).toBe("Budget about [fee]");
    expect(brief.decider).toBe("Chief Strategy Officer");
  });

  it("pick precedents from board cards the model reads without a single fee", async () => {
    const seen: ChatMessage[][] = [];
    const chat = async (messages: ChatMessage[], _options: ChatOptions) => (
      seen.push(messages), reply(JSON.stringify({ precedents: [{ board_id: "b5", closeness: "close", why: "Service line for a health system" }] }))
    );
    const brief = cleanBrief({ client: "regional health system", problem: "Diabetes prevention service line" });
    const picks = await pickPrecedents(chat, corpus, brief, undefined);
    expect(picks).toEqual([{ boardId: "b5", closeness: "close", why: "Service line for a health system" }]);
    const prompt = buildPickMessages(corpus, brief).map((message) => message.content).join("\n");
    expect(prompt).not.toMatch(/\$\s?\d/);
    expect(seen[0]!.map((message) => message.content).join("\n")).not.toMatch(/\$\s?\d/);
  });
});
