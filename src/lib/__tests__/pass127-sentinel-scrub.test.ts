import { describe, expect, it } from "vitest";

import { HANDOFF_SENTINEL, stripHandoffTail } from "@/lib/handoffs-shared";

/**
 * Pass 127.2. A sentinel-carrying fence is never legitimate reader-facing
 * content. When the model repeats the LASSO_HANDOFFS_V1 fence mid-answer,
 * the tail block stays the single source of items and every other sentinel
 * fence (or bare token) is scrubbed from the prose.
 */
const FENCE = (body: string) => "```json\n" + HANDOFF_SENTINEL + "\n" + body + "\n```";

const ITEM = {
  claim_quote: "revenue grew by 40 percent",
  location: "page 2",
  verdict: "nothing_visible",
  suggested_check: "ask for the source table",
};

const VALID = JSON.stringify({ open_checks: [ITEM] });

describe("sentinel fence scrub", () => {
  it("parses the tail and scrubs a mid-prose duplicate", () => {
    const text = `First para.\n\n${FENCE(JSON.stringify({ open_checks: [] }))}\n\nSecond para.\n\n${FENCE(VALID)}`;
    const r = stripHandoffTail(text, "open_checks");
    expect(r.parse).toBe("ok");
    expect(r.block?.items).toHaveLength(1);
    expect(r.prose).not.toContain(HANDOFF_SENTINEL);
    expect(r.prose).toContain("First para.");
    expect(r.prose).toContain("Second para.");
    expect(r.prose).toBe("First para.\n\nSecond para.");
  });

  it("never parses items from an earlier sentinel fence", () => {
    const mid = JSON.stringify({ open_checks: [{ ...ITEM, claim_quote: "mid claim" }] });
    const tail = JSON.stringify({ open_checks: [{ ...ITEM, claim_quote: "tail claim" }] });
    const text = `Answer.\n\n${FENCE(mid)}\n\nMore answer.\n\n${FENCE(tail)}`;
    const r = stripHandoffTail(text, "open_checks");
    expect(r.parse).toBe("ok");
    expect(r.block?.items).toHaveLength(1);
    expect((r.block?.items[0] as { claim_quote: string }).claim_quote).toBe("tail claim");
    expect(r.prose).not.toContain(HANDOFF_SENTINEL);
  });

  it("keeps prose sentinel free when a lone mid-prose fence is malformed", () => {
    const text = `First.\n\n${FENCE("{ broken")}\n\nSecond.`;
    const r = stripHandoffTail(text, "open_checks");
    expect(r.block).toBeNull();
    expect(r.parse).toBe("malformed");
    expect(r.prose).not.toContain(HANDOFF_SENTINEL);
    expect(r.prose).toBe("First.\n\nSecond.");
  });

  it("treats a lone valid mid-prose fence as the tail candidate, at most one block", () => {
    // Current semantics: the lone fence is the tail candidate. The trailing
    // prose after its closing fence makes the JSON unparseable, so nothing is
    // stored — but the outcome holds either way: prose never contains the
    // sentinel and at most one block is parsed.
    const text = `First.\n\n${FENCE(VALID)}\n\nSecond.`;
    const r = stripHandoffTail(text, "open_checks");
    expect(r.parse).toBe("malformed");
    expect(r.block).toBeNull();
    expect(r.prose).not.toContain(HANDOFF_SENTINEL);
    expect(r.prose).toBe("First.\n\nSecond.");
  });

  it("removes a bare sentinel token that has no fence", () => {
    const text = `Answer ${HANDOFF_SENTINEL} trailing.\n\n${FENCE(VALID)}`;
    const r = stripHandoffTail(text, "open_checks");
    expect(r.parse).toBe("ok");
    expect(r.block?.items).toHaveLength(1);
    expect(r.prose).not.toContain(HANDOFF_SENTINEL);
    expect(r.prose).toContain("Answer");
    expect(r.prose).toContain("trailing.");
  });

  it("returns malformed with scrubbed prose when only a bare sentinel exists", () => {
    const text = `Answer ${HANDOFF_SENTINEL} trailing.`;
    const r = stripHandoffTail(text, "open_checks");
    expect(r.block).toBeNull();
    expect(r.prose).not.toContain(HANDOFF_SENTINEL);
  });

  it("leaves an ordinary non-sentinel fence exactly where it is", () => {
    const ordinary = "```ts\nconst a = 1;\n```";
    const text = `Here is code:\n\n${ordinary}\n\nTail follows.\n\n${FENCE(VALID)}`;
    const r = stripHandoffTail(text, "open_checks");
    expect(r.parse).toBe("ok");
    expect(r.prose).toContain(ordinary);
    expect(r.prose).not.toContain(HANDOFF_SENTINEL);
  });

  it("still returns prose untouched when there is no sentinel at all", () => {
    const text = "An answer with no block.\n\n```json\n{\"a\":1}\n```";
    const r = stripHandoffTail(text, "open_checks");
    expect(r.prose).toBe(text);
    expect(r.block).toBeNull();
    expect(r.parse).toBe("none");
  });
});
