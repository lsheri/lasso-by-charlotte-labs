// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkNote } from "@/components/work/WorkNote";
import { grownDatesByItem, grownSuffix, type PushHistoryRow } from "@/lib/push-boundary";
import type { WorkItemRow } from "@/lib/work-types";

// Mock block copied from mob1-work-phone.test.tsx.
vi.mock("@/hooks/use-connector-accounts", () => ({ useConnectorAccounts: () => ({ data: {} }) }));
afterEach(cleanup);

const NOW = new Date(2026, 9, 26, 12);
const day = (d: number, m = 9) => new Date(2026, m, d, 12).toISOString();
const push = (n: number, d: number, extra: Partial<PushHistoryRow> = {}): PushHistoryRow => ({
  id: `p${n}`, work_item_id: "w1", pushed_at: day(d), mode: n === 1 ? "created" : "appended",
  turns_added: 2, turns_changed: 0, attachments_added: 0, attachments_changed: 0, ...extra,
});

const item = { id: "w1", title: "A chat", type: "ai_thread", visibility: "unmapped", captured_at: "2026-10-11T02:00:00Z", work_item_tasks: [], meta: null } as unknown as WorkItemRow;
const dateText = (container: HTMLElement) => container.querySelector(".canvas-card-date")?.textContent ?? "";

describe("PUSH-2c grown dates on the work card", () => {
  it("no prop and an empty list leave the date line exactly as before", () => {
    const before = dateText(render(<WorkNote item={item} headerGutter />).container);
    cleanup();
    const empty = dateText(render(<WorkNote item={item} headerGutter grownOn={[]} />).container);
    expect(before.length).toBeGreaterThan(0);
    expect(empty).toBe(before);
    expect(before).not.toContain("grown");
  });

  it("one growing push adds , grown 21 Oct after the existing date", () => {
    const before = dateText(render(<WorkNote item={item} headerGutter />).container);
    cleanup();
    const grown = grownDatesByItem([push(1, 14), push(2, 21)]).w1;
    const after = dateText(render(<WorkNote item={item} headerGutter grownOn={grown} />).container);
    expect(grownSuffix(grown, NOW)).toBe(", grown 21 Oct");
    expect(after).toBe(`${before}, grown 21 Oct`);
  });

  it("three growing pushes read , grown 14, 21 and 28 Oct", () => {
    expect(grownSuffix([day(14), day(21), day(28)], NOW)).toBe(", grown 14, 21 and 28 Oct");
  });

  it("five growing pushes show the three most recent and earlier", () => {
    const grown = grownDatesByItem([push(1, 1), push(2, 3), push(3, 7), push(4, 14), push(5, 21), push(6, 28)]).w1;
    expect(grownSuffix(grown, NOW)).toBe(", grown 14, 21 and 28 Oct and earlier");
  });

  it("an unchanged push, or one with all four counts zero, is not a growth", () => {
    const grown = grownDatesByItem([
      push(1, 7), push(2, 14, { mode: "unchanged" }), push(3, 18, { turns_added: 0 }), push(4, 21),
    ]).w1;
    expect(grown).toEqual([day(21)]);
  });

  it("an item's first push is never listed, and a single push gives nothing", () => {
    expect(grownDatesByItem([push(1, 14)])).toEqual({});
    expect(grownDatesByItem([push(2, 21), push(1, 14)]).w1).toEqual([day(21)]);
  });

  it("year only when not this year, never a time", () => {
    const s = grownSuffix([new Date(2025, 9, 21, 15, 30).toISOString()], NOW);
    expect(s).toBe(", grown 21 Oct 2025");
    expect(s).not.toMatch(/\d:\d/);
  });
});
