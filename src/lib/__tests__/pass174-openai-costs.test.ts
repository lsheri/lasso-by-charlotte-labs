import { describe, expect, it } from "vitest";

import {
  costWindow,
  dayKey,
  mapCostBuckets,
  shouldRunToday,
  OPENAI_PROJECT_LABELS,
} from "../openai-costs";

const NOW = Date.UTC(2026, 8, 8, 21, 30, 0); // 2026-09-08T21:30Z

describe("pass 174 date window", () => {
  it("covers the last seven whole days up to now", () => {
    const { startTime, endTime } = costWindow(NOW);
    expect(dayKey(startTime * 1000)).toBe("2026-09-02");
    expect(endTime).toBe(Math.floor(NOW / 1000));
    expect((endTime - startTime) / 86_400).toBeCloseTo(6.895, 2);
  });

  it("starts at midnight UTC", () => {
    const { startTime } = costWindow(NOW);
    expect(startTime % 86_400).toBe(0);
  });

  it("honours a shorter window", () => {
    expect(dayKey(costWindow(NOW, 1).startTime * 1000)).toBe("2026-09-08");
  });
});

describe("pass 174 mapping and idempotency", () => {
  const response = {
    data: [
      {
        start_time: Math.floor(Date.UTC(2026, 8, 7) / 1000),
        results: [
          { amount: { value: 1.5, currency: "usd" }, project_id: "proj_a" },
          { amount: { value: 0.5, currency: "usd" }, project_id: "proj_a" },
          { amount: { value: 2, currency: "usd" }, project_id: "proj_b" },
        ],
      },
      { start_time: Math.floor(Date.UTC(2026, 8, 8) / 1000), results: [] },
    ],
  };

  it("writes one row per day per project", () => {
    const rows = mapCostBuckets(response, "2026-09-08T21:30:00.000Z");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ day: "2026-09-07", openai_project_id: "proj_a", amount_usd: 2 });
    expect(rows[1]!.openai_project_id).toBe("proj_b");
  });

  it("produces identical keys on a second run, so an upsert writes no new rows", () => {
    const first = mapCostBuckets(response, "2026-09-08T21:30:00.000Z");
    const second = mapCostBuckets(response, "2026-09-09T02:00:00.000Z");
    const keys = (rows: typeof first) => rows.map((r) => `${r.day}|${r.openai_project_id}`);
    expect(keys(second)).toEqual(keys(first));
    expect(new Set(keys(second)).size).toBe(second.length);
  });

  it("leaves the label null while the map is empty and tokens null when absent", () => {
    expect(Object.keys(OPENAI_PROJECT_LABELS)).toHaveLength(0);
    const rows = mapCostBuckets(response, "x");
    expect(rows[0]!.project_label).toBeNull();
    expect(rows[0]!.input_tokens).toBeNull();
    expect(rows[0]!.output_tokens).toBeNull();
  });

  it("sums token counts when the endpoint provides them", () => {
    const rows = mapCostBuckets(
      {
        data: [
          {
            start_time: Math.floor(Date.UTC(2026, 8, 7) / 1000),
            results: [
              { amount: { value: 1 }, project_id: "proj_a", input_tokens: 10, output_tokens: 4 },
              { amount: { value: 1 }, project_id: "proj_a", input_tokens: 5, output_tokens: 1 },
            ],
          },
        ],
      },
      "x",
    );
    expect(rows[0]).toMatchObject({ input_tokens: 15, output_tokens: 5 });
  });
});

describe("pass 174 once-per-day guard", () => {
  it("allows the first run of a day", () => {
    expect(shouldRunToday(null, NOW)).toBe(true);
  });

  it("refuses a second run the same day", () => {
    expect(shouldRunToday("2026-09-08", NOW)).toBe(false);
    expect(shouldRunToday("2026-09-08", NOW + 3_600_000)).toBe(false);
  });

  it("allows a run once the day rolls over", () => {
    expect(shouldRunToday("2026-09-08", NOW + 12 * 3_600_000)).toBe(true);
  });
});
