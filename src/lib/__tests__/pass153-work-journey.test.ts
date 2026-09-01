import { describe, expect, it, vi } from "vitest";

import {
  DAYS_TO_SHIP_BANDS,
  THREADS_BANDS,
  TOOLS_COUNT_BANDS,
  TOTAL_TURNS_BANDS,
  daysToShipBand,
  journeyBands,
  threadsBand,
  toolsCountBand,
  totalTurnsBand,
} from "@/lib/work-journey";
import {
  OUTPUT_KINDS,
  OUTPUT_KIND_LABELS,
  guessOutputKind,
  parseArtifactDeclaration,
} from "@/lib/declared-work";

const recorded: { eventType: string; dims: Record<string, unknown> }[] = [];
vi.mock("@/lib/telemetry.server", () => ({
  recordEvent: async (_client: unknown, args: { eventType: string; dims: Record<string, unknown> }) => {
    recorded.push({ eventType: args.eventType, dims: args.dims });
  },
}));

const { noteWorkJourney } = await import("@/lib/work-journey.server");

/** The smallest client shape the emitter reads: links, items, turns. */
function fakeClient(opts: {
  links: { from_item_id: string; to_item_id: string }[];
  items: Record<string, unknown>[];
  turns: number;
}) {
  return {
    from(table: string) {
      if (table === "work_item_links") {
        return { select: () => ({ or: async () => ({ data: opts.links }) }) };
      }
      if (table === "turns") {
        return { select: () => ({ in: async () => ({ count: opts.turns }) }) };
      }
      return {
        select: () => ({
          in: async () => ({ data: opts.items }),
          eq: () => ({ maybeSingle: async () => ({ data: opts.items[0] ?? null }) }),
        }),
      };
    },
  } as never;
}

describe("pass 153 band edges", () => {
  it("bands thread counts", () => {
    expect(threadsBand(0)).toBe("0");
    expect(threadsBand(1)).toBe("1");
    expect(threadsBand(3)).toBe("2-3");
    expect(threadsBand(4)).toBe("4-6");
    expect(threadsBand(6)).toBe("4-6");
    expect(threadsBand(7)).toBe("7+");
  });

  it("bands turn totals at exact edges", () => {
    expect(totalTurnsBand(0)).toBe("0");
    expect(totalTurnsBand(5)).toBe("1-5");
    expect(totalTurnsBand(6)).toBe("6-15");
    expect(totalTurnsBand(15)).toBe("6-15");
    expect(totalTurnsBand(16)).toBe("16-40");
    expect(totalTurnsBand(40)).toBe("16-40");
    expect(totalTurnsBand(41)).toBe("41-100");
    expect(totalTurnsBand(100)).toBe("41-100");
    expect(totalTurnsBand(101)).toBe("100+");
  });

  it("bands distinct tools", () => {
    expect(toolsCountBand(0)).toBe("0");
    expect(toolsCountBand(2)).toBe("2");
    expect(toolsCountBand(9)).toBe("3+");
  });

  it("bands days on UTC calendar dates", () => {
    const day = (iso: string) => iso;
    expect(daysToShipBand(day("2026-01-01T23:00:00Z"), day("2026-01-01T23:59:00Z"))).toBe("same_day");
    expect(daysToShipBand(day("2026-01-01T23:00:00Z"), day("2026-01-02T00:30:00Z"))).toBe("2-3d");
    expect(daysToShipBand(day("2026-01-01T00:00:00Z"), day("2026-01-03T00:00:00Z"))).toBe("2-3d");
    expect(daysToShipBand(day("2026-01-01T00:00:00Z"), day("2026-01-04T00:00:00Z"))).toBe("4-7d");
    expect(daysToShipBand(day("2026-01-01T00:00:00Z"), day("2026-01-07T00:00:00Z"))).toBe("4-7d");
    expect(daysToShipBand(day("2026-01-01T00:00:00Z"), day("2026-01-08T00:00:00Z"))).toBe("8-30d");
    expect(daysToShipBand(day("2026-01-01T00:00:00Z"), day("2026-01-30T00:00:00Z"))).toBe("8-30d");
    expect(daysToShipBand(day("2026-01-01T00:00:00Z"), day("2026-01-31T00:00:00Z"))).toBe("30d+");
    expect(daysToShipBand(null, "2026-01-01T00:00:00Z")).toBe("same_day");
    expect(daysToShipBand("not a date", "2026-01-01T00:00:00Z")).toBe("same_day");
  });
});

describe("pass 153 emitter", () => {
  it("emits one banded event with closed-vocab dims", async () => {
    recorded.length = 0;
    const client = fakeClient({
      links: [{ from_item_id: "item-1", to_item_id: "thread-1" }],
      items: [
        {
          id: "thread-1",
          type: "ai_thread",
          source: "mcp",
          source_vendor: "claude",
          source_meta: null,
          captured_at: "2026-01-01T09:00:00Z",
          created_at_source: null,
        },
      ],
      turns: 7,
    });
    await noteWorkJourney(
      client,
      { orgId: "org-1", userId: "user-1", profileId: "profile-1" },
      { workItemId: "item-1", outputKind: "website", shippedAt: "2026-01-05T09:00:00Z" },
    );

    expect(recorded).toHaveLength(1);
    const event = recorded[0]!;
    expect(event.eventType).toBe("workitem.journey");
    expect(event.dims).toEqual({
      threads_band: "1",
      total_turns_band: "6-15",
      tools_count_band: "1",
      days_to_ship_band: "4-7d",
      output_kind: "website",
    });
    expect(THREADS_BANDS).toContain(event.dims["threads_band"]);
    expect(TOTAL_TURNS_BANDS).toContain(event.dims["total_turns_band"]);
    expect(TOOLS_COUNT_BANDS).toContain(event.dims["tools_count_band"]);
    expect(DAYS_TO_SHIP_BANDS).toContain(event.dims["days_to_ship_band"]);
    expect(OUTPUT_KINDS).toContain(event.dims["output_kind"]);
  });

  it("bands an unresolved linkage at the lowest bucket", async () => {
    recorded.length = 0;
    const client = fakeClient({ links: [], items: [], turns: 0 });
    await noteWorkJourney(
      client,
      { orgId: "org-1", userId: "user-1" },
      { workItemId: "item-1", outputKind: "plan", shippedAt: "2026-01-05T09:00:00Z" },
    );
    expect(recorded[0]?.dims).toMatchObject({
      threads_band: "0",
      total_turns_band: "0",
      tools_count_band: "0",
      days_to_ship_band: "same_day",
    });
  });

  it("refuses a kind outside the vocabulary before anything is recorded", async () => {
    recorded.length = 0;
    await expect(
      noteWorkJourney(fakeClient({ links: [], items: [], turns: 0 }), { orgId: "o", userId: "u" }, {
        workItemId: "item-1",
        outputKind: "poster" as never,
      }),
    ).rejects.toThrow();
    expect(recorded).toHaveLength(0);
  });
});

describe("pass 153 widened kinds", () => {
  it("keeps the original six and adds the new ones with labels", () => {
    for (const kind of ["deck", "model", "memo", "dataset", "analysis", "other"]) {
      expect(OUTPUT_KINDS).toContain(kind);
    }
    for (const kind of ["website", "design", "code", "pitch", "brief", "plan"]) {
      expect(OUTPUT_KINDS).toContain(kind);
      expect(OUTPUT_KIND_LABELS[kind as never]).toBeTruthy();
      expect(parseArtifactDeclaration({
        output_kind: kind,
        disposition: "shipped",
        ai_involvement: "none",
      }).output_kind).toBe(kind);
    }
  });

  it("pre-selects the new kinds from what we already hold", () => {
    expect(guessOutputKind({ type: "document", title: "landing.html" })).toBe("website");
    expect(guessOutputKind({ type: "document", title: "pricing-table.tsx" })).toBe("code");
    expect(guessOutputKind({ type: "document", title: "brand-board.fig" })).toBe("design");
    expect(guessOutputKind({ type: "code", title: "helper" })).toBe("code");
    expect(guessOutputKind({ type: "image", title: "hero" })).toBe("design");
    expect(guessOutputKind({ type: "document", title: "notes.csv" })).toBe("dataset");
  });

  it("keeps the labels plain", () => {
    const copy = Object.values(OUTPUT_KIND_LABELS).join(" ").toLowerCase();
    for (const banned of ["score", "monitor", "track", "—", "gaps", "compliance"]) {
      expect(copy).not.toContain(banned);
    }
  });
});
