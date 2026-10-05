// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const emitClientEvent = vi.fn();
vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: (...args: unknown[]) => emitClientEvent(...args) }));

const turn = (turn_no: number, role: string, content: string) => ({
  id: `t${turn_no}`, turn_no, role, content, content_hash: null, ts: null, model: null, meta: null,
});
let turns = [
  turn(1, "user", "Find the market size."),
  turn(2, "assistant", "Let me look that up."),
  turn(3, "tool", "search_web(market size)"),
  turn(4, "tool", "RAW RESULT 41 billion"),
  turn(5, "assistant", "The market is about 41 billion."),
];

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: turns, error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { ThreadBody } = await import("@/components/peek/ThreadBody");
const { ChatPreviewWindow } = await import("@/components/work/ChatPreviewWindow");
const { readWorkboardCardPreviews } = await import("@/lib/workboard-card-preview.server");
const { keptContentLabel } = await import("@/lib/work-open");
const { turnCards } = await import("@/lib/turn-story-shared");
const { publicSafeTurnExcerpts } = await import("@/lib/public-work-allowlist");
const { groupToolRuns, stepsBand, toolStepsLabel } = await import("@/lib/tool-steps");
const { EVENT_DIM_KEYS } = await import("@/lib/event-dim-allowlist");

const item = {
  id: "thread-1", title: "A conversation", type: "ai_thread", source: "paste", visibility: "private",
  captured_at: "2026-10-05T00:00:00Z", content_ref: null, created_at_source: null, work_date: null,
  work_item_tasks: [], meta: { expected_total: 9 },
} as never;

describe("TT1 tool steps", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    emitClientEvent.mockClear();
  });
  afterEach(cleanup);

  it("(a) groups consecutive tool turns and bands the count", () => {
    const segs = groupToolRuns(turns);
    expect(segs.map((s) => s.kind)).toEqual(["turn", "turn", "tools", "turn"]);
    expect(stepsBand(1)).toBe("1");
    expect(stepsBand(4)).toBe("2-4");
    expect(stepsBand(5)).toBe("5+");
    expect(toolStepsLabel(1)).toBe("1 tool step");
    expect(toolStepsLabel(3)).toBe("3 tool steps");
  });

  it("(b) reader collapses tool steps, keeps them in the DOM, opens on click, emits once per open", () => {
    const { container } = render(<ThreadBody item={item} reducedMotion />);
    const toggle = screen.getByTestId("tool-steps-toggle");
    expect(toggle.textContent).toBe("2 tool steps · Show");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const body = screen.getByTestId("tool-steps-body");
    expect(body.hidden).toBe(true);
    expect(body.querySelector('[data-turn-no="3"]')).not.toBeNull();
    expect(body.querySelector('[data-turn-no="4"]')).not.toBeNull();
    // user and assistant turns render outside the run, unchanged
    for (const n of [1, 2, 5]) expect(body.querySelector(`[data-turn-no="${n}"]`)).toBeNull();
    expect(container.querySelector('[data-turn-content="5"]')?.textContent).toBe("The market is about 41 billion.");
    // raw captured count still counts every stored turn
    expect(container.textContent).toContain("5 of 9 messages captured so far.");

    fireEvent.click(toggle);
    expect(body.hidden).toBe(false);
    expect(toggle.textContent).toBe("2 tool steps · Hide");
    expect(emitClientEvent).toHaveBeenCalledTimes(1);
    expect(emitClientEvent).toHaveBeenCalledWith("work.tool_steps_opened", { steps_band: "2-4" });
    fireEvent.click(toggle);
    expect(body.hidden).toBe(true);
    expect(emitClientEvent).toHaveBeenCalledTimes(1);
  });

  it("(c) a focus jump or an active finding on a tool turn opens its run", () => {
    render(<ThreadBody item={item} reducedMotion focus={{ turnNo: 4 }} />);
    expect(screen.getByTestId("tool-steps-body").hidden).toBe(false);
    cleanup();
    render(
      <ThreadBody
        item={item}
        reducedMotion
        activeMarkId="m1"
        marks={[{ id: "m1", turnNo: 3, quote: "market size", verdict: "unsourced" } as never]}
      />,
    );
    expect(screen.getByTestId("tool-steps-body").hidden).toBe(false);
    expect(emitClientEvent).not.toHaveBeenCalled();
  });

  it("(d) the event is registered with its one band dimension", () => {
    expect(EVENT_DIM_KEYS["work.tool_steps_opened"]).toEqual(["steps_band"]);
  });

  it("(e) board previews skip tool turns in turns and turnCount and report toolSteps", async () => {
    const rows = turns.map((t) => ({ work_item_id: "chat", turn_no: t.turn_no, role: t.role, content: t.content, model: null }));
    const turnIn = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: rows, error: null }) });
    const summaryIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const db = { from: vi.fn((table: string) => ({ select: vi.fn().mockReturnValue({ in: table === "turns" ? turnIn : summaryIn }) })) };
    const [preview] = await readWorkboardCardPreviews(db as never, ["chat"]);
    expect(preview?.turns.map((t) => t.turnNo)).toEqual([1, 2, 5]);
    expect(preview?.turnCount).toBe(3);
    expect(preview?.toolSteps).toBe(2);
  });

  it("(f) board card shows a plain tool-step line with no control", () => {
    render(<ChatPreviewWindow vendorKey={null} turns={[{ turnNo: 1, role: "user", content: "hi" }]} toolSteps={2} />);
    const line = screen.getByTestId("chat-preview-tool-steps");
    expect(line.textContent).toBe("2 tool steps");
    expect(line.tagName).toBe("P");
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    render(<ChatPreviewWindow vendorKey={null} turns={[]} />);
    expect(screen.queryByTestId("chat-preview-tool-steps")).toBeNull();
  });

  it("(g) the kept-content label names tool steps beside turns", () => {
    const thread = { type: "ai_thread", content_fidelity: "full" } as never;
    expect(keptContentLabel(thread, 3, 2)).toBe("3 turns kept in full, plus 2 tool steps");
    expect(keptContentLabel(thread, 3, 0)).toBe("3 turns kept in full");
    expect(keptContentLabel(thread, 1)).toBe("1 turn kept in full");
  });

  it("(h) story cards leave tool turns out", () => {
    const cards = turnCards("thread-1", turns);
    expect(cards.map((c) => c.turnNo)).toEqual([1, 2, 5]);
    expect(cards.some((c) => c.snippet.includes("RAW RESULT"))).toBe(false);
  });

  it("(i) public excerpts leave tool turns out", () => {
    const out = publicSafeTurnExcerpts(turns.map((t) => ({ ...t, ts: null })) as never);
    expect(out.map((t) => t.turn_no)).toEqual([1, 2, 5]);
    expect(JSON.stringify(out)).not.toContain("RAW RESULT");
  });

  it("keeps a thread with no tool turns free of the toggle", () => {
    const saved = turns;
    turns = saved.filter((t) => t.role !== "tool");
    render(<ThreadBody item={item} reducedMotion />);
    expect(screen.queryByTestId("tool-steps-toggle")).toBeNull();
    turns = saved;
  });
});
