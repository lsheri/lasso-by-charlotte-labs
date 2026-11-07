import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
}));

import { primeKey, primeReadSet, resetPrimeMemory } from "@/lib/ask-prime-client";
import { RECORD_ACK, buildReflectConversation } from "@/lib/prompt-assembly";

describe("TOTAL-5 cache priming, client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    resetPrimeMemory();
  });

  it("primes a board read set once per TTL and never the whole record", async () => {
    await primeReadSet({ mode: "engagements", ids: ["b1"], board: "b1" }, "p");
    await primeReadSet({ mode: "engagements", ids: ["b1"], board: "b1" }, "p");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/reflect/prime");
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body) as { scope: unknown; profile_id: string };
    expect(body).toEqual({ scope: { mode: "engagements", ids: ["b1"], board: "b1" }, profile_id: "p" });
    await primeReadSet({ mode: "whole", ids: [] }, "p");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a different selection is a different prime, and a failed prime may be retried", async () => {
    await primeReadSet({ mode: "items", ids: ["a", "b"] }, "p");
    await primeReadSet({ mode: "items", ids: ["b", "a"] }, "p");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(primeKey({ mode: "items", ids: ["b", "a"] })).toBe(primeKey({ mode: "items", ids: ["a", "b"] }));
    fetchMock.mockResolvedValueOnce({ ok: false });
    await primeReadSet({ mode: "items", ids: ["c"] }, "p");
    await primeReadSet({ mode: "items", ids: ["c"] }, "p");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("TOTAL-5 cache priming, the prefix the prime shares with the question", () => {
  it("the prime conversation and the question conversation agree up to the acknowledgement", () => {
    const prompts = [{ role: "system" as const, content: "SYS" }, { role: "system" as const, content: "WHERE" }];
    const docs = [{ id: "a", title: "Chat", kind: "conversation" as const, turnNumbers: [1], blocks: ["(turn 1, you said) hi"] }];
    const prime = buildReflectConversation({ prompts, historyMessages: [], scopeMode: "engagements", context: "", documents: docs, preamble: "INDEX", message: "Ready." });
    const question = buildReflectConversation({ prompts, historyMessages: [], scopeMode: "engagements", context: "", documents: docs, preamble: "INDEX", message: "what did I decide?", perQuestionNote: "WHAT LASSO READ FOR EARLIER ANSWERS: ..." });
    const ackAt = prime.findIndex((t) => t.content === RECORD_ACK);
    expect(ackAt).toBeGreaterThan(0);
    expect(prime.slice(0, ackAt + 1)).toEqual(question.slice(0, ackAt + 1));
    expect(prime.at(-1)!.content).toBe("Ready.");
  });
});
