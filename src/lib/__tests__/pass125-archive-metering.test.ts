import { beforeEach, describe, expect, it, vi } from "vitest";

import { runArchiveSearch } from "@/lib/archive-search.server";
import type { ArchiveCorpusEntry } from "@/lib/archive-search-shared";
import type { TelemetryEvent } from "@/lib/telemetry-shared";

const mocks = vi.hoisted(() => ({
  corpus: [] as ArchiveCorpusEntry[],
  chat: vi.fn(),
  createRun: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  recordEvent: vi.fn(),
}));

class FakeAiError extends Error {
  errorClass: string;
  constructor(message: string, errorClass: string) {
    super(message);
    this.errorClass = errorClass;
  }
}

vi.mock("@/lib/ai.server", () => ({
  chatComplete: mocks.chat,
  resolveAiMeta: vi.fn(async () => ({})),
  AiError: FakeAiError,
}));
vi.mock("@/lib/analysis-runs.server", () => ({
  createRun: mocks.createRun,
  completeRun: mocks.completeRun,
  failRun: mocks.failRun,
}));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: mocks.recordEvent }));
vi.mock("@/lib/shipped-work.server", () => ({ listShippedCards: vi.fn(async () => []) }));

vi.mock("@/lib/archive-search.server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/archive-search.server")>();
  return { ...mod, buildArchiveCorpus: vi.fn() };
});

function entry(id: string): ArchiveCorpusEntry {
  return {
    work_item_id: id,
    title: `Deck ${id}`,
    engagement_title: "Pricing work",
    brief: null,
    artifact_text: "We rebuilt the tiers from the client rate card.",
  };
}

/** A caller whose shipped read returns whatever the test set up. */
function fakeCaller() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ in: () => ({ order: async () => ({ data: [] }) }) }),
        }),
      }),
    }),
  } as never;
}

async function runWith(corpus: ArchiveCorpusEntry[]) {
  const mod = await import("@/lib/archive-search.server");
  vi.spyOn(mod, "buildArchiveCorpus").mockResolvedValue(corpus);
  return mod.runArchiveSearch(fakeCaller(), {
    question: "how do people build pricing decks here?",
    orgId: "org1",
    userId: "u1",
    profileId: "p1",
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.chat.mockReset();
  mocks.createRun.mockReset().mockResolvedValue({ id: "run1" });
  mocks.completeRun.mockReset().mockResolvedValue(undefined);
  mocks.failRun.mockReset().mockResolvedValue(undefined);
  mocks.recordEvent.mockReset().mockResolvedValue(undefined);
});

describe("pass 125: the archive search is metered", () => {
  it("writes exactly one completed run with the chat's own numbers", async () => {
    mocks.chat.mockResolvedValue({
      text: JSON.stringify({
        matches: [
          { work_item_id: "w1", why: "it rebuilt the tiers" },
          { work_item_id: "ghost", why: "invented" },
        ],
        best_match_id: "w1",
      }),
      tokensIn: 1200,
      tokensOut: 90,
      costUsd: 0.0042,
    });

    const out = await runWith([entry("w1"), entry("w2"), entry("w3")]);
    expect(out.matches).toHaveLength(1);

    expect(mocks.createRun).toHaveBeenCalledTimes(1);
    expect(mocks.createRun.mock.calls[0]![0]).toMatchObject({
      preset: "archive_search",
      scope_type: "org",
      scope_id: null,
      idempotency_key: null,
      org_id: "org1",
      owner_id: "p1",
      run_by_profile_id: "p1",
      session_id: null,
    });
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
    expect(mocks.completeRun.mock.calls[0]![1]).toMatchObject({
      items_read: 3,
      tokens_in: 1200,
      tokens_out: 90,
      cost_usd: 0.0042,
      claims_rendered: 1,
      suppressed_claims: 1,
      handoffs: null,
      context_manifest: null,
    });
    expect(mocks.failRun).not.toHaveBeenCalled();
  });

  it("emits archive.searched with counts only, never the question", async () => {
    mocks.chat.mockResolvedValue({
      text: JSON.stringify({ matches: [{ work_item_id: "w1", why: "tiers" }], best_match_id: "w1" }),
      tokensIn: 10,
      tokensOut: 5,
      costUsd: 0.001,
    });
    await runWith([entry("w1"), entry("w2"), entry("w3")]);

    const call = mocks.recordEvent.mock.calls[0]![1] as {
      eventType: TelemetryEvent;
      dims: Record<string, unknown>;
    };
    expect(call.eventType).toBe("archive.searched");
    expect(Object.keys(call.dims).sort()).toEqual(["matched", "results"]);
    expect(call.dims).toEqual({ results: "1-10", matched: true });
    expect(JSON.stringify(call.dims)).not.toContain("pricing decks");
  });

  it("spends and records nothing when the archive is too small", async () => {
    const out = await runWith([entry("w1"), entry("w2")]);
    expect(out.too_small).toBe(true);
    expect(mocks.chat).not.toHaveBeenCalled();
    expect(mocks.createRun).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it("fails the run with the error class and rethrows, emitting nothing", async () => {
    mocks.chat.mockRejectedValue(new FakeAiError("upstream is busy", "rate_limit"));
    await expect(runWith([entry("w1"), entry("w2"), entry("w3")])).rejects.toThrow(
      "upstream is busy",
    );
    expect(mocks.failRun).toHaveBeenCalledWith("run1", "rate_limit");
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it("falls back to model_error for a plain throw and never masks it", async () => {
    mocks.chat.mockRejectedValue(new Error("socket died"));
    mocks.failRun.mockRejectedValue(new Error("bookkeeping also died"));
    await expect(runWith([entry("w1"), entry("w2"), entry("w3")])).rejects.toThrow("socket died");
    expect(mocks.failRun).toHaveBeenCalledWith("run1", "model_error");
  });
});
