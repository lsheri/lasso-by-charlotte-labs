// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Server mock block copied from aq1-question-persist.test.tsx (passing before edits).
import { ensureQuestionRow, unansweredQuestionIds } from "@/lib/ask-question-persist";

type Row = { id: number; session_id: string; role: string; content: string; context_manifest?: unknown };
const log: string[] = [];
const events: { eventType: string; dims: unknown }[] = [];
let catalogue = false;
let rows: Row[] = [];
let nextId = 1;
let modelThrows = false;

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
vi.mock("@/lib/ai.server", () => ({
  resolveAiMeta: vi.fn(async () => ({})),
  chatComplete: vi.fn(async () => {
    log.push("model");
    if (modelThrows) throw new Error("model down");
    return { text: "An answer.", finishReason: "stop" };
  }),
  streamChat: vi.fn(),
}));
vi.mock("@/lib/record-catalogue.server", () => ({
  scopeItemCount: vi.fn(async () => catalogue ? 101 : 0),
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
  recordEvent: vi.fn(async (_s: unknown, e: { eventType: string; dims: unknown }) => { events.push(e); }),
}));
vi.mock("@/lib/question-intent.server", () => ({ classifyQuestionIntent: vi.fn(async () => {}) }));


vi.mock('@/lib/record-answer.server', () => ({ runCatalogueAnswer: vi.fn(async () => ({ answer: 'An answer.', sources: [], reads: [], quotable: [], catalogue: { entries: [], brief: { itemIds: [] } }, finishReason: 'stop', rounds: 1, toolCalls: 0, searches: 0, itemsFetched: 0, answerRetried: false, renditionsRead: 0 })) }));
vi.mock('@/lib/telemetry-v2.server', () => ({ recordEventV2: vi.fn(async () => {}) }));
const { runReflectTurn } = await import('@/lib/reflect-run.server');
describe('SECD-3a send event', () => {
  beforeEach(() => { events.length = 0; rows = []; nextId = 1; modelThrows = false; catalogue = false; });
  it.each([false, true])('section dimension once, card-only trail (catalogue=%s)', async (cat) => {
    catalogue = cat;
    const result = await runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: 'What matters?', surface: 'ask_lasso', scope_kind: 'section' });
    const sent = events.filter(e => e.eventType === 'reflect.message_sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.dims).toMatchObject({ scope_kind: 'section', context_mode: cat ? 'catalogue' : 'inline' });
    expect(sent[0]?.dims).not.toHaveProperty('section_id');
    expect(result.sources).toEqual([]);
    expect(result.manifest?.items).toEqual([]);
  });
  it.each([false, true])('ordinary send has no new dimension (catalogue=%s)', async (cat) => {
    catalogue = cat;
    await runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: 'What matters?' });
    expect(events.filter(e => e.eventType === 'reflect.message_sent')).toHaveLength(1);
    expect(events.find(e => e.eventType === 'reflect.message_sent')?.dims).not.toHaveProperty('scope_kind');
  });
});
