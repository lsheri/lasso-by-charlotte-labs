// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: vi.fn() }));

type T = { id: string; turn_no: number; role: string; content: string; content_hash: null; ts: null; model: null; meta: null; push_id: string | null };
const turn = (turn_no: number, role: string, push_id: string | null): T => ({
  id: `t${turn_no}`, turn_no, role, content: `Turn ${turn_no} text`, content_hash: null, ts: null, model: null, meta: null, push_id,
});

let turns: T[] = [];
let pushes: { id: string; pushed_at: string }[] = [];
const pushQueries: { enabled: boolean }[] = [];

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey: unknown[]; enabled?: boolean }) => {
    if (opts.queryKey[0] === "turn-pushes") {
      pushQueries.push({ enabled: opts.enabled !== false });
      return { data: opts.enabled === false ? undefined : pushes, error: null };
    }
    return { data: turns, error: null };
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { ThreadBody } = await import("@/components/peek/ThreadBody");
const { addedLabel } = await import("@/lib/push-boundary");

const item = {
  id: "thread-1", title: "A conversation", type: "ai_thread", source: "mcp:claude", visibility: "private",
  captured_at: "2026-10-05T00:00:00Z", content_ref: null, created_at_source: null, work_date: null,
  work_item_tasks: [], meta: {},
} as never;

const thisYear = new Date().getFullYear();

describe("PUSH-2a push boundary rules", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    pushQueries.length = 0;
    pushes = [
      { id: "p1", pushed_at: `${thisYear}-10-14T10:30:00` },
      { id: "p2", pushed_at: `${thisYear}-10-21T15:45:00` },
    ];
  });
  afterEach(cleanup);

  it("draws no rule when no turn has a push", () => {
    turns = [turn(1, "user", null), turn(2, "assistant", null)];
    render(<ThreadBody item={item} />);
    expect(screen.queryAllByTestId("push-boundary")).toHaveLength(0);
  });

  it("draws nothing at the first push of a chat", () => {
    turns = [turn(1, "user", "p1"), turn(2, "assistant", "p1"), turn(3, "user", "p1")];
    render(<ThreadBody item={item} />);
    expect(screen.queryAllByTestId("push-boundary")).toHaveLength(0);
  });

  it("draws 'Added 21 Oct' above the first turn of a later push", () => {
    turns = [turn(1, "user", "p1"), turn(2, "assistant", "p1"), turn(3, "user", "p2"), turn(4, "assistant", "p2")];
    const { container } = render(<ThreadBody item={item} />);
    const rules = screen.getAllByTestId("push-boundary");
    expect(rules).toHaveLength(1);
    expect(rules[0]!.textContent).toBe("Added 21 Oct");
    expect(container.querySelector('[data-turn-no="3"]')!.contains(rules[0]!)).toBe(true);
  });

  it("never shows a time of day or a person, and shows the year only when it differs", () => {
    turns = [turn(1, "user", null), turn(2, "assistant", null), turn(3, "user", "p2")];
    render(<ThreadBody item={item} />);
    const text = screen.getByTestId("push-boundary").textContent ?? "";
    expect(text).not.toMatch(/\d{1,2}:\d{2}/);
    expect(text).not.toMatch(/\bby\b/i);
    expect(addedLabel(`${thisYear}-10-21T23:10:00`)).toBe("Added 21 Oct");
    expect(addedLabel("2025-10-21T12:00:00", new Date(`${thisYear === 2025 ? 2026 : thisYear}-01-05T12:00:00`))).toBe("Added 21 Oct 2025");
  });

  it("makes no push query when every turn's push is null", () => {
    turns = [turn(1, "user", null), turn(2, "assistant", null)];
    render(<ThreadBody item={item} enabled />);
    expect(pushQueries.length).toBeGreaterThan(0);
    expect(pushQueries.every((q) => !q.enabled)).toBe(true);
  });
});
