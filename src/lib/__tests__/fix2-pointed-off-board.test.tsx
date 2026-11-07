// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// FIX-2: server mock block copied from fix1-window-fallback.test.tsx.

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
  chatComplete: vi.fn(async (conversation: { role: string; content: string }[]) => {
    log.push("model");
    sentConversations.push(conversation);
    if (modelThrows) throw Object.assign(new Error("That was too much material for one answer. Try a narrower scope."), { errorClass: "context_length" });
    return { text: "An answer.", finishReason: "stop" };
  }),
  streamChat: vi.fn(),
}));
vi.mock("@/lib/record-catalogue.server", () => ({
  scopeItemCount: vi.fn(async () => catalogue ? 101 : 0),
  CATALOGUE_THRESHOLD: 100,
}));
const sentConversations: { role: string; content: string }[][] = [];
let narrowResult: { scope: unknown; excluded: { title: string; reason: string }[]; offBoard: string[] } | null = null;
vi.mock("@/lib/reflect-context.server", () => ({
  narrowToPointed: vi.fn(async (_s: unknown, _o: unknown, sessionScope: unknown) => narrowResult ?? { scope: sessionScope, excluded: [], offBoard: [] }),
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
describe('FIX-2: work pointed at outside the read set is named, never read', () => {
  beforeEach(() => { events.length = 0; rows = []; nextId = 1; modelThrows = false; catalogue = false; catalogueCalls.length = 0; log.length = 0; sentConversations.length = 0; narrowResult = null; });

  it('an own item on another board is named to the model as not read, and recorded as excluded', async () => {
    narrowResult = { scope: { mode: 'engagements', ids: ['b'] }, excluded: [{ title: 'D8 Notes.md', reason: 'not part of this workboard' }], offBoard: ['D8 Notes.md'] };
    const result = await runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: '@D8 Notes.md what are my next steps?', surface: 'ask_lasso', pointed_at: ['notes'] });
    const last = sentConversations[0]!.at(-1)!.content;
    expect(last).toContain('THE PERSON POINTED AT WORK YOU HAVE NOT READ: "D8 Notes.md"');
    expect(last).toContain('Do not guess at its contents');
    expect(result.manifest?.excluded).toContainEqual({ title: 'D8 Notes.md', reason: 'not part of this workboard' });
  });

  it('an item the person cannot see adds nothing: no note, no title, no exclusion', async () => {
    narrowResult = { scope: { mode: 'engagements', ids: ['b'] }, excluded: [], offBoard: [] };
    const result = await runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: '@that item, what does it say?', surface: 'ask_lasso', pointed_at: ['someone-elses'] });
    expect(sentConversations[0]!.map((t) => t.content).join(' ')).not.toContain('POINTED AT WORK YOU HAVE NOT READ');
    expect(result.manifest?.excluded).toEqual([]);
  });

  it('the note rides in the question turn, after the cached record, not in the system prompts', async () => {
    narrowResult = { scope: { mode: 'engagements', ids: ['b'] }, excluded: [{ title: 'X', reason: 'not part of this workboard' }], offBoard: ['X'] };
    await runReflectTurn(fakeSupabase(), 'u1', { session_id: 's1', message: 'q', surface: 'ask_lasso', pointed_at: ['x'] });
    const conv = sentConversations[0]!;
    expect(conv.filter((t) => t.role === 'system').some((t) => t.content.includes('POINTED AT WORK'))).toBe(false);
    expect(conv.at(-1)!.content).toContain('POINTED AT WORK');
  });
});
