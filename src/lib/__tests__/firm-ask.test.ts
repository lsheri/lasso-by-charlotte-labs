// 17 Nov: the Ask the firm engine (firm-brain-review RECOMMENDATION section 3). Every shown claim has a quote code
// found word for word; the model never sees or types a fee; opinions about people never survive; summary-only
// bodies are never loaded; one retry when every quote fails; "not found" never stretches.
import { describe, expect, it } from "vitest";

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import { asksAboutPeople, checkClaims, holdsOpinion, maskFees } from "@/lib/firm-ask-shared";
import { pickedIds, runFirmAsk } from "@/lib/firm-ask.server";
import type { FirmCorpus } from "@/lib/firm-corpus-shared";

const corpus: FirmCorpus = {
  orgId: "org",
  boards: [
    { id: "b5", title: "Weight management service line", client: "St. Brigid Health", brief: "Design a service line. Fee $380,000 fixed.", lead: "Tiago Pereira", startedOn: "2025-03-03", outcome: "Ran to plan. Client extended.", askerIsOnBoard: false },
    { id: "b6", title: "Behavioral health service line", client: "Cedarmere", brief: "Primary care anchored.", lead: "Mei Tanaka", startedOn: "2024-05-06", outcome: "Overran. Client extended. Start payer conversations alongside the diagnostic.", askerIsOnBoard: false },
  ],
  items: [
    { id: "sow5", boardId: "b5", type: "document", title: "SOW", date: "2025-02-24", summary: "16-week $380k SOW", decisions: null, entities: null, grade: "full", shown: [], sowFacts: { fee_text: "$380k", fee_amount: 380000, fee_basis: "fixed", weeks: 16 }, kind: null },
    { id: "deck5", boardId: "b5", type: "deck", title: "Final readout", date: "2025-06-20", summary: "Recommends a single front door.", decisions: null, entities: null, grade: "full", shown: [{ on: "2025-06-24", occasion: "Board" }], sowFacts: null, kind: null },
    { id: "call6", boardId: "b6", type: "call", title: "CFO check-in", date: "2024-07-15", summary: "Medicare Advantage volumes by plan are still missing, which puts the business case at risk.", decisions: "COO to request the plan volumes", entities: null, grade: "summary", shown: [], sowFacts: null, kind: null },
  ],
};

const TEXT: Record<string, string> = {
  sow5: "Statement of work. Fee: $380,000 fixed. Scope: 20 to 25 interviews with patients and clinicians.",
  deck5: "Slide 3: Getting surgery a vote in governance early unlocked the design. Slide 4: one front door in primary care.",
  call6: "The CFO is difficult and will stall on the payer numbers.",
};

function reply(text: string): ChatResult {
  return { text, toolArgs: null, toolCalls: [], finishReason: "stop", model: "fake", tokensIn: 100, tokensOut: 50, cachedIn: 0, costUsd: 0.01, durationMs: 1 };
}

/** A fake model: call A picks `pick`, call B answers with each of `answers` in turn. */
function fake(pick: string[], ...answers: object[]) {
  const seen: { messages: ChatMessage[]; options: ChatOptions }[] = [];
  const loaded: string[] = [];
  let answer = 0;
  return {
    seen,
    loaded,
    deps: {
      chat: async (messages: ChatMessage[], options: ChatOptions) => {
        seen.push({ messages, options });
        if (options.tier === "fast") return reply(JSON.stringify({ items: pick.map((id) => ({ id, why: "relevant" })), boards: [] }));
        return reply(JSON.stringify(answers[Math.min(answer++, answers.length - 1)]));
      },
      loadText: async (id: string) => (loaded.push(id), TEXT[id] ?? null),
    },
  };
}

const ask = (deps: ReturnType<typeof fake>["deps"], canSeeFees = false) => runFirmAsk(deps, { corpus, question: "Have we done weight management work?", canSeeFees, meta: undefined });

describe("Ask the firm", () => {
  it("answers with quoted claims and a facts strip built by code", async () => {
    const model = fake(["deck5", "sow5"], {
      claims: [{ text: "Giving surgery a vote early unlocked the design.", item_id: "deck5", quote: "Getting surgery a vote in governance early unlocked the design" }],
      summary: "The firm designed a weight management service line.",
    });
    const { result, usage } = await ask(model.deps);
    expect(result.status).toBe("answered");
    expect(result.claims).toEqual([expect.objectContaining({ itemId: "deck5", boardId: "b5", grade: "quoted" })]);
    expect(result.summary).toBe("The firm designed a weight management service line.");
    expect(result.facts).toEqual([expect.objectContaining({ boardId: "b5", weeks: 16, lead: "Tiago Pereira", fee: null })]);
    expect(result.oneSource).toBe(true);
    expect(result.coverage).toBe("Read 2 engagements shared with the firm. Some engagements are not shared.");
    expect(result.read.full).toEqual(["deck5", "sow5"]);
    expect(usage.calls).toBe(2);
  });

  it("shows fees only to people with fee access, and only from data", async () => {
    const model = fake(["deck5"], { claims: [{ text: "One front door.", item_id: "deck5", quote: "one front door in primary care" }] });
    const { result } = await ask(model.deps, true);
    expect(result.facts[0]!.fee).toBe("$380k");
  });

  it("never lets the model see a fee", async () => {
    const model = fake(["sow5", "deck5"], { claims: [] , not_found: true });
    await ask(model.deps);
    const everything = model.seen.flatMap((call) => call.messages.map((message) => message.content)).join("\n");
    expect(everything).not.toMatch(/\$\s?\d/);
    expect(everything).toContain("[fee]");
  });

  it("drops a claim whose quote is not in the source, retries once, then says not found", async () => {
    const made = { claims: [{ text: "They ran 40 interviews.", item_id: "sow5", quote: "we ran forty interviews across all sites" }], nearest: "The closest work is a service line design." };
    const model = fake(["sow5"], made, made);
    const { result, usage } = await ask(model.deps);
    expect(result.status).toBe("not_found");
    expect(result.claims).toEqual([]);
    expect(result.nearest).toBe("The closest work is a service line design.");
    expect(usage.calls).toBe(3);
  });

  it("keeps a good claim after a retry", async () => {
    const model = fake(
      ["deck5"],
      { claims: [{ text: "x", item_id: "deck5", quote: "not in the deck at all, made up" }] },
      { claims: [{ text: "One front door.", item_id: "deck5", quote: "one front door in primary care" }] },
    );
    const { result } = await ask(model.deps);
    expect(result.status).toBe("answered");
    expect(result.claims).toHaveLength(1);
  });

  it("never loads a summary-only body, and grades claims from its index card", async () => {
    const model = fake(["call6"], { claims: [{ text: "Plan volumes were missing.", item_id: "call6", quote: "Medicare Advantage volumes by plan are still missing" }] });
    const { result } = await ask(model.deps);
    expect(model.loaded).not.toContain("call6");
    const prompt = model.seen[1]!.messages[1]!.content;
    expect(prompt).not.toContain("difficult");
    expect(result.claims[0]!.grade).toBe("from_summary");
    expect(result.read.summary).toEqual(["call6"]);
  });

  it("drops an opinion about a person even when the quote is real", async () => {
    const onBoard = { ...corpus, items: corpus.items.map((item) => (item.id === "call6" ? { ...item, grade: "full" as const } : item)) };
    const model = fake(["call6"], { claims: [{ text: "The CFO stalls.", item_id: "call6", quote: "The CFO is difficult and will stall on the payer numbers" }] });
    const { result } = await runFirmAsk(model.deps, { corpus: onBoard, question: "What was the client like?", canSeeFees: false, meta: undefined });
    expect(result.claims).toEqual([]);
    expect(result.status).toBe("not_found");
  });

  it("refuses questions that rank people, and shows the matching engagements instead", async () => {
    const model = fake(["deck5"], { about_people: true, claims: [] });
    const { result } = await ask(model.deps);
    expect(result.status).toBe("about_people");
    expect(result.claims).toEqual([]);
    expect(result.facts.map((fact) => fact.boardId)).toEqual(["b5"]);
  });

  it("refuses a question about people in code, even when the picking call finds nothing, with no answer call", async () => {
    const none = fake([], { claims: [] });
    const empty = await runFirmAsk(none.deps, { corpus, question: "Who is our best person for health system work?", canSeeFees: false, meta: undefined });
    expect(empty.result.status).toBe("about_people");
    const picked = fake(["deck5"], { claims: [{ text: "x", item_id: "deck5", quote: "y" }] });
    const found = await runFirmAsk(picked.deps, { corpus, question: "Who is our best person for health system work?", canSeeFees: false, meta: undefined });
    expect(found.result.status).toBe("about_people");
    expect(found.result.facts.map((fact) => fact.boardId)).toEqual(["b5"]);
    expect(found.usage.calls).toBe(1);
  });

  it("tells people questions from work questions", () => {
    for (const question of ["Who is our best person for health system work?", "Who's the strongest analyst?", "Rank our consultants on delivery", "Who are our top performers?", "Who performs best with CFOs?", "Compare the partners on revenue work"])
      expect(asksAboutPeople(question), question).toBe(true);
    for (const question of ["Have we done weight management work?", "What went wrong last time?", "What is our best approach to payer talks?", "Who was the client sponsor at Cedarmere?", "What have we charged for revenue work?"])
      expect(asksAboutPeople(question), question).toBe(false);
  });

  it("says not found without a second call when nothing is picked, and ignores ids outside the corpus", async () => {
    const model = fake(["b13-secret-item"], { claims: [] });
    const { result, usage } = await ask(model.deps);
    expect(result.status).toBe("not_found");
    expect(usage.calls).toBe(1);
  });

  it("hides the summary when any claim was dropped", async () => {
    const model = fake(["deck5"], {
      claims: [
        { text: "One front door.", item_id: "deck5", quote: "one front door in primary care" },
        { text: "Made up.", item_id: "deck5", quote: "this sentence is nowhere in the deck" },
      ],
      summary: "Both things are true.",
    });
    const { result } = await ask(model.deps);
    expect(result.claims).toHaveLength(1);
    expect(result.summary).toBeNull();
  });
});

describe("the claim checks", () => {
  const read = [{ itemId: "sow5", boardId: "b5", grade: "full" as const, text: maskFees(TEXT["sow5"]!) }];

  it("masks every money figure the model could see", () => {
    expect(maskFees("$380k, $380,000 fixed, $45k/month and $1.2M")).toBe("[fee], [fee] fixed, [fee] and [fee]");
    expect(maskFees("£340,000, €1.2M, USD 90,000, 380k GBP, 45,000 dollars and £30k per month")).toBe("[fee], [fee], [fee], [fee], [fee] and [fee]");
    expect(maskFees("12 weeks, 24 clinics, 9.6 percent, FY2025")).toBe("12 weeks, 24 clinics, 9.6 percent, FY2025");
  });

  it("drops a claim that repeats a masked fee or types a figure", () => {
    expect(checkClaims([{ text: "The fee was [fee].", item_id: "sow5", quote: "Fee: [fee] fixed" }], read).claims).toEqual([]);
    expect(checkClaims([{ text: "It cost $380k.", item_id: "sow5", quote: "20 to 25 interviews with patients" }], read).claims).toEqual([]);
  });

  it("knows the opinion words, and only as words", () => {
    expect(holdsOpinion("The CFO is difficult")).toBe(true);
    expect(holdsOpinion("She oversells to the board")).toBe(true);
    expect(holdsOpinion("Installation was straightforward")).toBe(false);
  });
});

describe("a reply cut off at its token limit", () => {
  // The first live run (18 Nov) lost every answer this way: call A ran out of tokens mid-JSON.
  const ids = (text: string) => pickedIds(text, { ...corpus, items: corpus.items.map((item, index) => ({ ...item, id: `0000000${index}-0000-4000-8000-000000000000` })) });

  it("still yields the ids it named, in order, known to the corpus only", () => {
    expect(ids('{"items": ["00000001-0000-4000-8000-000000000000", "00000000-0000-4000-8000-000000000000", "99999999-0000-4000-8000-0000000')).toEqual([
      "00000001-0000-4000-8000-000000000000",
      "00000000-0000-4000-8000-000000000000",
    ]);
  });

  it("reads a whole reply as before, objects or strings", () => {
    expect(ids('{"items": [{"id": "00000002-0000-4000-8000-000000000000", "why": "x"}]}')).toEqual(["00000002-0000-4000-8000-000000000000"]);
  });
});

describe("close-out lessons", () => {
  // The second live run missed "what have we learned about getting client data on time": those lessons live in each
  // engagement's close-out line, which call A could not pick.
  it("can be picked, quoted and cited as the engagement's close-out lesson", async () => {
    const model = fake(["outcome-b6"], {
      claims: [{ text: "Start payer talks alongside the diagnostic.", item_id: "outcome-b6", quote: "Start payer conversations alongside the diagnostic" }],
    });
    const { result } = await ask(model.deps);
    expect(result.status).toBe("answered");
    expect(result.claims[0]).toMatchObject({ itemId: "outcome-b6", boardId: "b6", grade: "quoted" });
    expect(result.sources["outcome-b6"]).toMatchObject({ title: "Close-out lesson", type: "outcome", boardTitle: "Behavioral health service line" });
    expect(model.loaded).toEqual([]);
    expect(model.seen[0]!.messages[1]!.content).toContain("CLOSE-OUT outcome-b6:");
  });

  it("are recovered from a cut-off reply too", () => {
    const uuidCorpus = { ...corpus, boards: corpus.boards.map((board, index) => ({ ...board, id: `0000000${index}-0000-4000-8000-000000000000` })), items: [] };
    expect(pickedIds('{"items": ["outcome-00000001-0000-4000-8000-000000000000", "outcome-0000', uuidCorpus)).toEqual(["outcome-00000001-0000-4000-8000-000000000000"]);
  });
});

// 19 Nov (Liam's decision D-6): a proposal draft on a board shared with the firm is findable by topic. A saved draft
// has no summary card, so its gist (made by code from its own sections) stands in; both model calls are told a
// proposal draft counts as a match; and a claim from one always says it is a draft.
describe("a saved proposal draft", () => {
  const GIST =
    "About one in three primary care adults at the client has prediabetes on paper, and almost nobody is in a program.";
  const BODY = `# Proposal draft\n\n## Context\n${GIST} Fee $120,000.\n`;
  const withDraft = (gist: string | null, grade: "full" | "summary" = "full"): FirmCorpus => ({
    ...corpus,
    boards: [
      ...corpus.boards,
      {
        id: "b31",
        title: "Diabetes prevention service line (proposal)",
        client: "Marrowfield",
        brief: null,
        lead: "Harper Quinn",
        startedOn: "2026-11-17",
        outcome: null,
        askerIsOnBoard: false,
      },
    ],
    items: [
      ...corpus.items,
      {
        id: "draft31",
        boardId: "b31",
        type: "document",
        title: "Proposal draft: new service line",
        date: null,
        summary: null,
        decisions: null,
        entities: null,
        grade,
        shown: [],
        sowFacts: null,
        kind: "proposal",
        proposalDraft: { gist },
      },
    ],
  });
  const askDraft = (deps: ReturnType<typeof fake>["deps"], firm: FirmCorpus) =>
    runFirmAsk(
      { ...deps, loadText: async (id) => (id === "draft31" ? BODY : deps.loadText(id)) },
      {
        corpus: firm,
        question: "Have we worked on prediabetes for a health system?",
        canSeeFees: false,
        meta: undefined,
      },
    );
  const cardOf = (messages: ChatMessage[]) =>
    messages[1]!.content
      .toString()
      .split("\n")
      .find((line) => line.includes("ITEM draft31")) ?? "";

  it("puts what the draft is about on its card for the picking call, marked as a proposal draft", async () => {
    const model = fake([]);
    await askDraft(model.deps, withDraft(GIST));
    const card = cardOf(model.seen[0]!.messages);
    expect(card).toContain("[document, proposal draft]");
    expect(card).toContain("prediabetes");
    expect(model.seen[0]!.messages[0]!.content).toMatch(
      /proposal draft.*counts as the firm's work on its topic/,
    );
  });

  it("leaves every other card as it was, and a draft with nothing to say keeps its title only", async () => {
    const model = fake([]);
    await askDraft(model.deps, withDraft(null));
    const text = model.seen[0]!.messages[1]!.content.toString();
    expect(cardOf(model.seen[0]!.messages)).toBe(
      "  ITEM draft31 [document, proposal draft] Proposal draft: new service line",
    );
    expect(text).toContain(
      "  ITEM deck5 [deck] Final readout | date 2025-06-20 | summary: Recommends a single front door.",
    );
  });

  it("never shows a fee on the card, even when the draft's own words hold one", async () => {
    const model = fake([]);
    await askDraft(model.deps, withDraft(`${GIST} The budget is $120,000.`));
    expect(cardOf(model.seen[0]!.messages)).not.toMatch(/\$\s?\d/);
  });

  it("tells the answering call the document is a proposal draft and that it is a match, not near work", async () => {
    const model = fake(["draft31"], {
      claims: [
        {
          text: "The firm is writing a proposal draft on prediabetes.",
          item_id: "draft31",
          quote: "almost nobody is in a program",
        },
      ],
      summary: "",
    });
    const { result } = await askDraft(model.deps, withDraft(GIST));
    const sent = model.seen[1]!.messages;
    expect(sent[1]!.content).toContain(
      '<document id="draft31" board="Diabetes prevention service line (proposal)" type="proposal draft"',
    );
    expect(sent[0]!.content).toMatch(
      /Never set "not_found" only because the matching work is a proposal draft/,
    );
    expect(sent[1]!.content).not.toMatch(/\$\s?\d/);
    expect(result.status).toBe("answered");
    expect(result.claims[0]).toMatchObject({
      itemId: "draft31",
      boardId: "b31",
      grade: "quoted",
      text: "The firm is writing a proposal draft on prediabetes.",
    });
  });

  it("opens the claim with 'Proposal draft, not delivered work' when the model did not say it is one", async () => {
    const model = fake(["draft31", "deck5"], {
      claims: [
        {
          text: "About a third of adults have prediabetes.",
          item_id: "draft31",
          quote: "almost nobody is in a program",
        },
        {
          text: "One front door in primary care.",
          item_id: "deck5",
          quote: "one front door in primary care",
        },
      ],
      summary: "",
    });
    const { result } = await askDraft(model.deps, withDraft(GIST));
    expect(result.claims.map((claim) => claim.text)).toEqual([
      "Proposal draft, not delivered work: About a third of adults have prediabetes.",
      "One front door in primary care.",
    ]);
  });

  it("can be cited from its gist when the asker may only read its card", async () => {
    const model = fake(["draft31"], {
      claims: [
        {
          text: "A proposal draft covers prediabetes.",
          item_id: "draft31",
          quote: "almost nobody is in a program",
        },
      ],
      summary: "",
    });
    const { result } = await askDraft(model.deps, withDraft(GIST, "summary"));
    expect(model.loaded).toEqual([]);
    expect(result.read).toEqual({ full: [], summary: ["draft31"] });
    expect(result.claims[0]?.grade).toBe("from_summary");
  });
});
