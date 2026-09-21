import { describe, expect, it } from "vitest";

import { orderByWorkDate, resolveWorkDate, resolvedDayKey } from "@/lib/work-order";

const mixed = [
  { id: "a", created_at_source: "2026-03-02T10:00:00Z", captured_at: "2026-09-01T10:00:00Z" },
  { id: "b", captured_at: "2026-05-04T10:00:00Z" },
  { id: "c", created_at_source: "2026-08-20T10:00:00Z", captured_at: "2026-08-21T10:00:00Z" },
  { id: "d", captured_at: "2026-01-09T10:00:00Z" },
  { id: "e", work_date: "2026-07-01T10:00:00Z", captured_at: "2026-02-02T10:00:00Z" },
];

describe("the one ordering rule", () => {
  it("orders newest first by the date it resolved, derived from the inputs", () => {
    const ordered = orderByWorkDate(mixed);

    const expected = [...mixed]
      .map((item) => ({ item, at: new Date(resolveWorkDate(item).iso).getTime() }))
      .sort((a, b) => b.at - a.at)
      .map((entry) => entry.item.id);

    expect(ordered.map((item) => item.id)).toEqual(expected);
    // and the resolution itself is the source date when there is one
    for (const item of mixed) {
      const resolved = resolveWorkDate(item);
      expect(resolved.iso).toBe(item.work_date ?? item.created_at_source ?? item.captured_at);
    }
  });

  it("marks an item with no date of its own as resolved by arrival, and one with a date not", () => {
    for (const item of mixed) {
      const resolved = resolveWorkDate(item);
      const hasOwn = Boolean(item.work_date ?? item.created_at_source);
      expect(resolved.byArrival).toBe(!hasOwn);
      expect(resolved.kind).toBe(hasOwn ? "source" : "arrival");
      expect(resolved.iso).toBe(hasOwn ? (item.work_date ?? item.created_at_source) : item.captured_at);
    }
  });

  it("keeps a stable relative order when two resolved dates are equal", () => {
    const same = "2026-04-04T09:00:00Z";
    const pair = [
      { id: "first", created_at_source: same, captured_at: "2026-09-09T09:00:00Z" },
      { id: "second", captured_at: same },
      { id: "third", work_date: same, captured_at: "2026-01-01T09:00:00Z" },
    ];
    expect(orderByWorkDate(pair).map((item) => item.id)).toEqual(pair.map((item) => item.id));
    expect(orderByWorkDate([...pair].reverse()).map((item) => item.id)).toEqual(
      [...pair].reverse().map((item) => item.id),
    );
  });

  it("groups on the same date it orders by", () => {
    for (const item of mixed) {
      expect(resolvedDayKey(item)).toBe(resolveWorkDate(item).iso.slice(0, 10));
    }
  });
});
