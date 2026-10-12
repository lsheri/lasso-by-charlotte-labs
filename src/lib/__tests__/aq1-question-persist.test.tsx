// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoAnswerSaved } from "@/components/reflect/NoAnswerSaved";
import { ensureQuestionRow, unansweredQuestionIds } from "@/lib/ask-question-persist";

type Row = { id: number; session_id: string; role: string; content: string; context_manifest?: unknown };
const log: string[] = [];
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
}));
vi.mock("@/lib/question-intent.server", () => ({ classifyQuestionIntent: vi.fn(async () => {}) }));

async function turn(message = "What did I decide?") {
  const { runReflectTurn } = await import("@/lib/reflect-run.server");
  return runReflectTurn(fakeSupabase(), "u1", { session_id: "s1", message, surface: "ask_lasso" });
}

describe("AQ-1 server", () => {
  beforeEach(() => {
    log.length = 0;
    rows = [];
    nextId = 1;
    modelThrows = false;
  });

  it("persists the user message before context assembly and the model call", async () => {
    await turn();
    expect(log.indexOf("insert:user")).toBeGreaterThanOrEqual(0);
    expect(log.indexOf("insert:user")).toBeLessThan(log.indexOf("assemble"));
    expect(log.indexOf("insert:user")).toBeLessThan(log.indexOf("model"));
    expect(rows.map((r) => r.role)).toEqual(["user", "assistant"]);
    expect(log.filter((l) => l === "event:reflect.message_sent")).toHaveLength(1);
    expect(log.indexOf("event:reflect.message_sent")).toBeGreaterThan(log.indexOf("insert:assistant"));
  });

  it("a thrown model error leaves the user message and no assistant row, and no event", async () => {
    modelThrows = true;
    await expect(turn()).rejects.toThrow("model down");
    expect(rows.map((r) => r.role)).toEqual(["user"]);
    expect(log).not.toContain("event:reflect.message_sent");
  });

  it("a retry of the same send does not duplicate the user row", async () => {
    modelThrows = true;
    await expect(turn()).rejects.toThrow();
    modelThrows = false;
    await turn();
    expect(rows.map((r) => `${r.role}:${r.content}`)).toEqual([
      "user:What did I decide?",
      "assistant:An answer.",
    ]);
  });

  it("ensureQuestionRow reuses only a trailing identical unanswered question", async () => {
    rows = [];
    const reuse = await ensureQuestionRow(fakeSupabase(), "s1", "Same", [
      { id: 7, role: "user", content: "Same" },
    ]);
    expect(reuse).toMatchObject({ userMessageId: 7, reused: true, history: [] });
    expect(rows).toHaveLength(0);
    const fresh = await ensureQuestionRow(fakeSupabase(), "s1", "Same", [
      { id: 7, role: "user", content: "Same" },
      { id: 8, role: "assistant", content: "A" },
    ]);
    expect(fresh.reused).toBe(false);
    expect(rows).toHaveLength(1);
  });
});

describe("AQ-1 No answer saved", () => {
  it("flags unanswered questions, but not the one in flight", () => {
    const msgs = [
      { id: 1, role: "user" },
      { id: 2, role: "user" },
      { id: 3, role: "assistant" },
      { id: 4, role: "user" },
    ];
    expect([...unansweredQuestionIds(msgs, false)]).toEqual(["1", "4"]);
    expect([...unansweredQuestionIds(msgs, true)]).toEqual(["1"]);
  });

  it("renders the quiet line with a working resend", () => {
    const onResend = vi.fn();
    render(<NoAnswerSaved onResend={onResend} />);
    const line = screen.getByTestId("no-answer-saved");
    expect(line.textContent).toBe("No answer saved.Ask again");
    expect(line.textContent).not.toMatch(/\u2014/);
    fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
    expect(onResend).toHaveBeenCalledTimes(1);
  });
});
