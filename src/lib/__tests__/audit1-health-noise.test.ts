import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.rows.push({ table, ...row });
        return { error: null };
      },
    }),
  },
}));

import { healthFirstToday, logHealthOncePerDay, resetHealthDedupe } from "../health.server";

/**
 * AUDIT-1 (7 Nov 2026). A3 F17: 94 of 164 empty_context rows in one week were
 * the same four unreadable items, re-reported on every Ask. One row per key per
 * UTC day is enough for anyone reading the table or the channel.
 */
describe("AUDIT-1: health rows for a repeat condition are written once a day", () => {
  beforeEach(() => {
    resetHealthDedupe();
    inserted.rows = [];
  });

  it("the first sighting of a key on a day is logged, the rest are not", () => {
    const noon = Date.UTC(2026, 10, 7, 12, 0, 0);
    expect(healthFirstToday("item_text:abc:unreadable:no_stored_bytes", noon)).toBe(true);
    expect(healthFirstToday("item_text:abc:unreadable:no_stored_bytes", noon + 60_000)).toBe(false);
    expect(healthFirstToday("item_text:abc:unreadable:no_stored_bytes", noon + 5 * 3_600_000)).toBe(false);
  });

  it("a new UTC day opens the key again", () => {
    const late = Date.UTC(2026, 10, 7, 23, 59, 0);
    expect(healthFirstToday("extract:abc:no_readable_text", late)).toBe(true);
    expect(healthFirstToday("extract:abc:no_readable_text", late + 2 * 60_000)).toBe(true);
  });

  it("two different items are two rows", () => {
    const now = Date.UTC(2026, 10, 7, 12, 0, 0);
    expect(healthFirstToday("extract:a:no_readable_text", now)).toBe(true);
    expect(healthFirstToday("extract:b:no_readable_text", now)).toBe(true);
  });

  it("logHealthOncePerDay writes the first row and swallows the repeat", async () => {
    const input = { kind: "empty_context" as const, surface: "extract", detail: "no_readable_text" };
    await logHealthOncePerDay("extract:x:no_readable_text", input);
    await logHealthOncePerDay("extract:x:no_readable_text", input);
    await logHealthOncePerDay("extract:x:no_readable_text", input);
    expect(inserted.rows).toHaveLength(1);
    expect(inserted.rows[0]).toMatchObject({ table: "ai_health_events", kind: "empty_context", surface: "extract" });
  });
});
