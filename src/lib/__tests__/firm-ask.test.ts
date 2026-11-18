// 17 Nov: the Ask the firm engine (firm-brain-review RECOMMENDATION section 3). Every shown claim has a quote code
// found word for word; the model never sees or types a fee; opinions about people never survive; summary-only
// bodies are never loaded; one retry when every quote fails; "not found" never stretches.
import { describe, expect, it } from "vitest";

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import { checkClaims, holdsOpinion, maskFees } from "@/lib/firm-ask-shared";
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
