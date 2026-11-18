// 17 Nov, firm brain PR 6: the red pen. Claims are exact snippets of the deliverable; a source counts only when its
// quote is found word for word; exact is Sourced, paraphrase Weak, nothing Unsupported. Batches read the sources
// most likely to hold their claims.
import { describe, expect, it } from "vitest";

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import { b07 } from "@/lib/demo-firm/boards/b07-willowmere";
import { checkExtracted, rankSources } from "@/lib/red-pen-shared";
import { runRedPen } from "@/lib/red-pen.server";

const deck = [
  "## Slide 1",
  "Cardiometabolic opportunity",
  "## Slide 2",
  "Specialist referrals leak out of network at 38 percent.",
  "## Slide 3",
  "GLP-1 prescribing doubled in two years.",
  "## Slide 4",
  "A single front door would recover most of the leakage.",
].join("\n");

const upstream = [
  { id: "sizing", title: "Market sizing sheet", text: "Out-of-network leakage for specialist referrals: 38 percent in FY2025.", turns: [] },
  { id: "interview", title: "Interview: CMO", text: "GLP-1 prescribing has gone up a lot, maybe 60 percent over two years.", turns: [] },
  { id: "unrelated", title: "Kickoff notes", text: "Parking is on level two. Lunch at noon.", turns: [] },
];

function reply(text: string): ChatResult {
  return { text, toolArgs: null, toolCalls: [], finishReason: "stop", model: "fake", tokensIn: 10, tokensOut: 10, cachedIn: 0, costUsd: 0.01, durationMs: 1 };
}

function fake(extract: object | string, trace: object) {
  const seen: { messages: ChatMessage[]; options: ChatOptions }[] = [];
  return {
    seen,
    chat: async (messages: ChatMessage[], options: ChatOptions) => {
      seen.push({ messages, options });
      return reply(options.tier === "fast" ? (typeof extract === "string" ? extract : JSON.stringify(extract)) : JSON.stringify(trace));
    },
  };
}

const claims = {
  claims: [
    { text: "Specialist referrals leak out of network at 38 percent." },
    { text: "GLP-1 prescribing doubled in two years." },
    { text: "A single front door would recover most of the leakage." },
    { text: "Revenue grew 400 percent last year." },
  ],
};

describe("the red pen", () => {
  it("grades exact support Sourced, a paraphrase Weak and nothing Unsupported, by slide", async () => {
    const model = fake(claims, {
      results: [
        { claim: 1, status: "exact", to_item_id: "sizing", quote: "Out-of-network leakage for specialist referrals: 38 percent", explanation: "Same figure." },
        { claim: 2, status: "paraphrase", to_item_id: "interview", quote: "GLP-1 prescribing has gone up a lot, maybe 60 percent over two years", explanation: "60 percent, not doubled." },
        { claim: 3, status: "unsourced" },
      ],
    });
    const { result, usage } = await runRedPen(model.chat, { itemId: "deck", anchorTitle: "Opportunity readout", anchorText: deck, upstream, meta: undefined, now: new Date("2026-11-17T12:00:00Z") });
    expect(result.claims.map((claim) => [claim.slide, claim.grade])).toEqual([
      [2, "sourced"],
      [3, "weak"],
      [4, "unsupported"],
    ]);
    expect(result.claims[0]).toMatchObject({ sourceItemId: "sizing", sourceTitle: "Market sizing sheet" });
    expect(result.counts).toEqual({ sourced: 1, weak: 1, unsupported: 1 });
    expect(usage.calls).toBe(2);
  });

  it("keeps a document quote when the model also gives a turn number, which only conversations have", async () => {
    const model = fake(claims, { results: [{ claim: 1, status: "exact", to_item_id: "sizing", to_turn_no: 0, quote: "Out-of-network leakage for specialist referrals: 38 percent" }, { claim: 2, status: "paraphrase", to_item_id: "interview", to_turn_no: 3, quote: "maybe 60 percent over two years" }] });
    const { result } = await runRedPen(model.chat, { itemId: "deck", anchorTitle: "x", anchorText: deck, upstream, meta: undefined });
    expect(result.claims.map((claim) => claim.grade)).toEqual(["sourced", "weak", "unsupported"]);
  });

  it("drops a listed claim that is not in the deliverable", async () => {
    const model = fake(claims, { results: [] });
    const { result } = await runRedPen(model.chat, { itemId: "deck", anchorTitle: "x", anchorText: deck, upstream, meta: undefined });
    expect(result.claims.map((claim) => claim.snippet)).not.toContain("Revenue grew 400 percent last year.");
  });

  it("downgrades a source whose quote is not really in it", async () => {
    const model = fake(claims, { results: [{ claim: 1, status: "exact", to_item_id: "sizing", quote: "leakage is exactly 38 percent everywhere" }] });
    const { result } = await runRedPen(model.chat, { itemId: "deck", anchorTitle: "x", anchorText: deck, upstream, meta: undefined });
    expect(result.claims[0]!.grade).toBe("unsupported");
    expect(result.claims[0]!.quote).toBeNull();
  });

  it("keeps the claims of a list cut off at its token limit", async () => {
    const cut = '{"claims": [{"text": "Specialist referrals leak out of network at 38 percent."}, {"text": "GLP-1 prescribing dou';
    const model = fake(cut, { results: [] });
    const { result } = await runRedPen(model.chat, { itemId: "deck", anchorTitle: "x", anchorText: deck, upstream, meta: undefined });
    expect(result.claims.map((claim) => claim.snippet)).toEqual(["Specialist referrals leak out of network at 38 percent."]);
  });

  it("reads the sources most likely to hold the claims", () => {
    expect(rankSources(["Specialist referrals leak out of network at 38 percent."], upstream, 1)[0]!.id).toBe("sizing");
  });
});

describe("the demo firm's planted claims", () => {
  it("are exact snippets the red pen can list from Willowmere's deck", () => {
    const red = b07.items.find((item) => item.unsupported?.length)!;
    const listed = checkExtracted(red.unsupported!.map((text) => ({ text })), red.body!);
    expect(listed).toHaveLength(red.unsupported!.length);
    expect(listed.every((claim) => claim.slide !== null)).toBe(true);
  });
});
