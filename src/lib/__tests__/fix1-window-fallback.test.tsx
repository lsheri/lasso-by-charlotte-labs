// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// FIX-1: server mock block copied from secd3a-section-ask-event.test.tsx.

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
    if (modelThrows) throw Object.assign(new Error("That was too much material for one answer. Try a narrower scope."), { errorClass: "context_length" });
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


const catalogueCalls: unknown[] = [];
vi.mock('@/lib/record-answer.server', () => ({ runCatalogueAnswer: vi.fn(async (_s: unknown, input: unknown) => (catalogueCalls.push(input), { answer: 'An answer.', sources: [], reads: [], quotable: [], catalogue: { entries: [], brief: { itemIds: [] } }, finishReason: 'stop', rounds: 1, toolCalls: 0, searches: 0, itemsFetched: 0, answerRetried: false, renditionsRead: 0 })) }));
vi.mock('@/lib/telemetry-v2.server', () => ({ recordEventV2: vi.fn(async () => {}) }));
const { runReflectTurn } = await import('@/lib/reflect-run.server');
describe('FIX-1: an inline prompt refused as too long falls back to the catalogue', () => {
  beforeEach(() => { events.length = 0; rows = []; nextId = 1; modelThrows = false; catalogue = false; catalogueCalls.length = 0; log.length = 0; });

  it('answers from the catalogue instead of showing the error, and says so in the event', async () => {
    modelThrows = true;
    const result = await runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: 'How many boards have conversations?', surface: 'ask_lasso' });
    expect(result.contextMode).toBe('catalogue');
    expect(result.answer).toBe('An answer.');
    expect(catalogueCalls).toHaveLength(1);
    const sent = events.filter((e) => e.eventType === 'reflect.message_sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.dims).toMatchObject({ context_mode: 'catalogue', catalogue_fallback: 'over_window' });
    expect(rows.filter((r) => r.role === 'assistant')).toHaveLength(1);
  });

  it('an inline answer that fits never touches the catalogue and carries no fallback dimension', async () => {
    const result = await runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: 'What matters?', surface: 'ask_lasso' });
    expect(result.contextMode).toBe('inline');
    expect(catalogueCalls).toHaveLength(0);
    expect(events.find((e) => e.eventType === 'reflect.message_sent')?.dims).not.toHaveProperty('catalogue_fallback');
  });

  it('any other model error still reaches the person', async () => {
    const ai = await import('@/lib/ai.server');
    (ai.chatComplete as unknown as { mockImplementationOnce: (f: () => never) => void }).mockImplementationOnce(() => { throw Object.assign(new Error('The model is rate limited right now.'), { errorClass: 'rate_limit' }); });
    await expect(runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: 'What matters?', surface: 'ask_lasso' })).rejects.toThrow('rate limited');
    expect(catalogueCalls).toHaveLength(0);
  });
});
