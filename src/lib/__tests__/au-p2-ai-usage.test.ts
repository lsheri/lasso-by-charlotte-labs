// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aiUsageRow, type AiMeta, type ChatResult } from "@/lib/ai.server";

type Row = { id: number; session_id: string; role: string; content: string; context_manifest?: unknown };
const log: string[] = [];
let rows: Row[] = [];
let nextId = 1;

function fakeSupabase() {
  return {
    from(table: string) {
      const q: Record<string, unknown> = {};
      let pendingInsert: Omit<Row, "id">[] | null = null;
      const result = () => {
        if (pendingInsert && table !== "chat_messages") return { data: null, error: null };
        if (pendingInsert) {
          const made = pendingInsert.map((r) => ({ ...r, id: nextId++ }));
          rows.push(...made);
          made.forEach((r) => log.push(`insert:${r.role}`));
          return { data: made, error: null };
        }
        if (table === "chat_sessions")
          return { data: { id: "s1", profile_id: "p1", title: null, context_scope: { mode: "whole", ids: [] } }, error: null };
        if (table === "chat_messages") return { data: rows.filter((r) => r.session_id === "s1"), error: null };
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve(result()),
        update: () => chain,
        insert: (v: Omit<Row, "id"> | Omit<Row, "id">[]) => {
          pendingInsert = (Array.isArray(v) ? v : [v]) as Omit<Row, "id">[];
          return chain;
        },
        maybeSingle: () => Promise.resolve(result()),
        single: () => {
          const r = result();
          return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: null });
        },
        then: (ok: (v: unknown) => unknown) => Promise.resolve(result()).then(ok),
      };
      void q;
      return chain;
    },
  } as never;
}

vi.mock("@/lib/profile-resolve", () => ({
  resolveProfile: vi.fn(async () => ({ id: "p1", org_id: "o1" })),
}));
const usageRows: ReturnType<typeof aiUsageRow>[] = [];
vi.mock("@/lib/ai.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai.server")>()),
  chatComplete: vi.fn(async (_messages: unknown, options: { meta: AiMeta }) => {
    const result: ChatResult = { text: "An answer.", finishReason: "stop", model: "gpt-5", tokensIn: 1200, tokensOut: 340, cachedIn: 200, costUsd: 0.00235, durationMs: 4211, toolArgs: null, toolCalls: [] };
    usageRows.push(aiUsageRow(result, options.meta));
    return result;
  }),
  streamChat: vi.fn(),
}));
vi.mock("@/lib/record-catalogue.server", () => ({
  scopeItemCount: vi.fn(async () => 0),
  CATALOGUE_THRESHOLD: 100,
}));
vi.mock("@/lib/reflect-context.server", () => ({
  assembleReflectContext: vi.fn(async () => {
    log.push("assemble");
    return {
      manifest: { items: [], excluded: [] },
      itemCount: 0,
      unreadableCount: 0,
      tier1Count: 0,
      tier2Count: 0,
      truncated: false,
      context: "",
      sources: [],
      quotable: [],
      reads: [],
    };
  }),
}));
vi.mock("@/lib/quote-guard.server", () => ({
  guardQuotes: vi.fn(async (a: string) => ({ answer: a, unmatchedBefore: 0, repairs: 0, suppressed: 0 })),
}));
vi.mock("@/lib/ai-reads.server", () => ({ recordAiReads: vi.fn(async () => {}) }));
vi.mock("@/lib/telemetry.server", () => ({
  recordEvent: vi.fn(async (_s: unknown, e: { eventType: string }) => log.push(`event:${e.eventType}`)),
  computeActorHash: vi.fn(async () => "actor-not-for-row"),
}));
vi.mock("@/lib/question-intent.server", () => ({ classifyQuestionIntent: vi.fn(async () => {}) }));

async function turn(message = "What did I decide?") {
  const { runReflectTurn } = await import("@/lib/reflect-run.server");
  return runReflectTurn(fakeSupabase(), "u1", { session_id: "s1", message, surface: "ask_lasso" });
}

describe("AU-P2 caller attribution", () => {
  beforeEach(() => { rows = []; nextId = 1; usageRows.length = 0; });
  it("carries the caller profile through an ask_lasso turn into its ai_usage row", async () => {
    await turn();
    expect(usageRows).toHaveLength(1);
    expect(usageRows[0]).toMatchObject({ surface: "ask_lasso", profile_id: "p1", org_id: "o1" });
  });
});
