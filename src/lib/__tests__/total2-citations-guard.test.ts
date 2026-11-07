import { beforeEach, describe, expect, it, vi } from "vitest";

const chatComplete = vi.fn();
vi.mock("@/lib/ai.server", () => ({ chatComplete: (...args: unknown[]) => chatComplete(...args) }));
vi.mock("@/lib/ai-health.server", () => ({ logHealth: vi.fn().mockResolvedValue(undefined) }));

import { guardQuotes } from "@/lib/quote-guard.server";
import { citationsFromManifest, turnRefsFromCitations } from "@/lib/turn-labels";

const SOURCE = "The floor price is set by D8taOps and cannot be discounted away by anyone.";

describe("TOTAL-2 quote guard with citations", () => {
  beforeEach(() => chatComplete.mockReset());

  it("never runs the repair turn when the model returned citations", async () => {
    const answer = 'They wrote "the floor price is set by D8taOps and cannot be discounted away by anyone" and also "something the model made up entirely here".';
    const out = await guardQuotes(answer, "", false, [], undefined, {
      citedTexts: [SOURCE],
      repair: false,
    });
    expect(chatComplete).not.toHaveBeenCalled();
    expect(out.repairs).toBe(0);
    expect(out.answer).toContain("cannot be discounted away by anyone");
    expect(out.answer).toContain("something the model made up entirely here (restated, not verbatim)");
    expect(out.suppressed).toBe(1);
    expect(out.costUsd).toBe(0);
  });

  it("still repairs on the path with no citations", async () => {
    chatComplete.mockResolvedValue({ text: "Rewritten without the bad quote.", finishReason: "stop", model: "gpt", tokensIn: 1, tokensOut: 1, cachedIn: 0, costUsd: 0.001 });
    const out = await guardQuotes('They said "a span that is not in the source at all anywhere".', "unrelated source text", false, [], undefined, {});
    expect(chatComplete).toHaveBeenCalledTimes(1);
    expect(out.repairs).toBe(1);
    expect(out.answer).toBe("Rewritten without the bad quote.");
  });
});

describe("TOTAL-2 citations become turn links", () => {
  const conversations = [{ id: "c1", title: "Diligence chat" }];

  it("a cited turn joins the chips once, a file citation does not", () => {
    const refs = turnRefsFromCitations(
      [
        { item_id: "c1", turn_no: 7, text: "x" },
        { item_id: "c1", turn_no: 7, text: "y" },
        { item_id: "doc", turn_no: null, text: "z" },
      ],
      conversations,
      [{ work_item_id: "c1", turn_no: 2, label: "Diligence chat, turn 2" }],
    );
    expect(refs).toEqual([
      { work_item_id: "c1", turn_no: 2, label: "Diligence chat, turn 2" },
      { work_item_id: "c1", turn_no: 7, label: "Diligence chat, turn 7" },
    ]);
  });

  it("reads citations off a stored manifest without trusting its shape", () => {
    expect(citationsFromManifest({ citations: [{ item_id: "a", turn_no: 3, text: "t" }, { bad: true }, 4] })).toEqual([
      { item_id: "a", turn_no: 3, text: "t" },
      { item_id: null, turn_no: null, text: "" },
    ]);
    expect(citationsFromManifest(null)).toEqual([]);
    expect(citationsFromManifest({ items: [] })).toEqual([]);
  });
});
