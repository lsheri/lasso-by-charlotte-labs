// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import { canTakeBackCard } from "@/components/firm/FirmArchive";
import { PrivacyPanel } from "@/components/firm/PrivacyPanel";
import { JourneySpine } from "@/components/journey/JourneyView";
import { JOURNEY_THIN_LINE, JOURNEY_VIEWER_LINE } from "@/lib/journey";
import {
  SHIP_CONFIRM_BODY,
  SHIP_CONFIRM_PRIMARY,
  SHIP_CONFIRM_SECONDARY,
  SHIP_CONFIRM_TITLE,
  SHOWCASE_CAP,
  TAKE_BACK_CONFIRM_LINE,
  recordFactsLine,
  type ShippedCard,
} from "@/lib/shipped-work-shared";
import {
  SHIP_CARD_NOT_FOUND,
  SHIP_NOT_DELIVERABLE,
  shipWorkRow,
  unshipWorkRow,
} from "@/lib/shipped-work.server";

afterEach(cleanup);

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

function card(over: Partial<ShippedCard> = {}): ShippedCard {
  return {
    id: "s1",
    work_item_id: "w1",
    engagement_id: "e1",
    shipped_at: "2026-03-01T00:00:00.000Z",
    shipped_by: "p1",
    shipped_by_name: "Ada",
    title: "Board deck",
    type: "deck",
    source: null,
    source_vendor: null,
    source_meta: null,
    meta: null,
    owner_id: "p1",
    work_date: null,
    created_at_source: null,
    engagement_code: "Art-001",
    client_label: "Artemis",
    engagement_title: null,
    engagement_brief: null,
    record_items: 0,
    traced_facts: 0,
    ...over,
  };
}

/** A tiny stand-in for the parts of the client these functions touch. */
function fakeCaller(rows: {
  item?: { id: string; owner_id: string; org_id: string; type: string } | null;
  shipped?: { id: string; work_item_id: string; shipped_by: string } | null;
}) {
  return {
    from(table: string) {
      const data =
        table === "work_items" ? (rows.item ?? null) : table === "shipped_work" ? (rows.shipped ?? null) : null;
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data, error: null }),
      };
      return chain;
    },
  } as never;
}

function fakeAdmin() {
  const calls: { upsert: unknown[]; deleted: string[] } = { upsert: [], deleted: [] };
  const client = {
    from() {
      const chain = {
        upsert(row: unknown, options: unknown) {
          calls.upsert.push({ row, options });
          return chain;
        },
        delete: () => chain,
        eq(_col: string, value: string) {
          calls.deleted.push(value);
          return chain;
        },
        select: () => ({
          single: async () => ({
            data: {
              id: "s1",
              org_id: "o1",
              work_item_id: "w1",
              engagement_id: "e1",
              shipped_by: "p1",
              shipped_at: "now",
            },
            error: null,
          }),
          then: (resolve: (value: unknown) => unknown) =>
            resolve({ data: [{ id: calls.deleted[0] }], error: null }),
        }),
      };
      return chain;
    },
  };
  return { client: client as never, calls };
}

const OWNER = { id: "p1", role: "em" };
const ITEM = { id: "w1", owner_id: "p1", org_id: "o1", type: "deck" };

describe("111.1 shipping is owner initiated and never duplicates", () => {
  it("upserts on the org and item pair, so a re-ship replaces the card", async () => {
    const admin = fakeAdmin();
    const row = await shipWorkRow(fakeCaller({ item: ITEM }), admin.client, {
      workItemId: "w1",
      engagementId: "e1",
      profile: OWNER,
    });
    expect(row.work_item_id).toBe("w1");
    expect(admin.calls.upsert).toHaveLength(1);
    expect(admin.calls.upsert[0]).toMatchObject({ options: { onConflict: "org_id,work_item_id" } });
  });

  it("refuses a coach", async () => {
    await expect(
      shipWorkRow(fakeCaller({ item: ITEM }), fakeAdmin().client, {
        workItemId: "w1",
        engagementId: null,
        profile: { id: "p1", role: "coach" },
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  it("refuses somebody who does not own the work", async () => {
    await expect(
      shipWorkRow(fakeCaller({ item: ITEM }), fakeAdmin().client, {
        workItemId: "w1",
        engagementId: null,
        profile: { id: "other", role: "em" },
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  it("refuses work that is not a deliverable", async () => {
    await expect(
      shipWorkRow(fakeCaller({ item: { ...ITEM, type: "ai_thread" } }), fakeAdmin().client, {
        workItemId: "w1",
        engagementId: null,
        profile: OWNER,
      }),
    ).rejects.toThrow(SHIP_NOT_DELIVERABLE);
  });
});

describe("111.2 taking a card back", () => {
  const shipped = { id: "s1", work_item_id: "w1", shipped_by: "p9" };

  it("removes exactly one row for the shipper", async () => {
    const admin = fakeAdmin();
    const result = await unshipWorkRow(fakeCaller({ item: ITEM, shipped }), admin.client, {
      workItemId: "w1",
      profile: { id: "p9", role: "em" },
    });
    expect(result.deleted).toBe(1);
    expect(admin.calls.deleted).toEqual(["s1"]);
  });

  it("removes for the owner as well", async () => {
    const result = await unshipWorkRow(fakeCaller({ item: ITEM, shipped }), fakeAdmin().client, {
      workItemId: "w1",
      profile: OWNER,
    });
    expect(result.deleted).toBe(1);
  });

  it("refuses anybody else", async () => {
    await expect(
      unshipWorkRow(fakeCaller({ item: ITEM, shipped }), fakeAdmin().client, {
        workItemId: "w1",
        profile: { id: "stranger", role: "em" },
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  it("says so when there is no card", async () => {
    await expect(
      unshipWorkRow(fakeCaller({ item: ITEM, shipped: null }), fakeAdmin().client, {
        workItemId: "w1",
        profile: OWNER,
      }),
    ).rejects.toThrow(SHIP_CARD_NOT_FOUND);
  });

  it("gates the menu to the shipper or the owner", () => {
    const c = card({ shipped_by: "p9", owner_id: "p1" });
    expect(canTakeBackCard({ id: "p9", role: "em" }, c)).toBe(true);
    expect(canTakeBackCard({ id: "p1", role: "em" }, c)).toBe(true);
    expect(canTakeBackCard({ id: "px", role: "em" }, c)).toBe(false);
    expect(canTakeBackCard({ id: "p1", role: "coach" }, c)).toBe(false);
  });
});

describe("111.3 the confirm copy is exact", () => {
  it("says the words the founder wrote", () => {
    expect(SHIP_CONFIRM_TITLE).toBe("Ship to the firm archive");
    expect(SHIP_CONFIRM_BODY).toBe(
      "Ship finished work only. The firm will see this card, who shipped it, and its journey. Shipping the same work again replaces the card, it never duplicates.",
    );
    expect(SHIP_CONFIRM_PRIMARY).toBe("Ship it");
    expect(SHIP_CONFIRM_SECONDARY).toBe("Not yet");
    expect(TAKE_BACK_CONFIRM_LINE).toBe(
      "Takes this card out of the archive. The work is untouched.",
    );
    for (const line of [SHIP_CONFIRM_TITLE, SHIP_CONFIRM_BODY, TAKE_BACK_CONFIRM_LINE]) {
      expect(line).not.toContain("—");
    }
  });
});

describe("111.4 the card speaks about work, never about a person", () => {
  it("shows the facts line only when the counts are real", () => {
    expect(recordFactsLine({ record_items: 0, traced_facts: 0 })).toBeNull();
    expect(recordFactsLine({ record_items: 1, traced_facts: 0 })).toBe(
      "1 piece of work in the record",
    );
    expect(recordFactsLine({ record_items: 4, traced_facts: 2 })).toBe(
      "4 pieces of work in the record · 2 facts traced",
    );
  });

  it("renders no person metric vocabulary", () => {
    render(<ShippedWorkCard card={card({ record_items: 4, traced_facts: 2 })} canTakeBack={false} />);
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const word of ["prompt", "efficiency", "score", "rating"]) {
      expect(text).not.toContain(word);
    }
    expect(screen.getByText("Board deck")).toBeTruthy();
    expect(text).toContain("shipped by ada");
  });

  it("stays static when motion is not wanted", () => {
    const node = render(
      <ShippedWorkCard card={card()} canTakeBack={false} />,
    ).container.querySelector("[data-testid='shipped-card-w1']");
    // jsdom reports no reduced-motion match, so the class pair is the pin.
    expect(node?.className).toMatch(/nb-chip-enter/);
  });
});

describe("111.5 the archive is the only exception the firm view admits", () => {
  it("amends the honesty card and leaves the other lines alone", () => {
    render(<PrivacyPanel />);
    const text = document.body.textContent ?? "";
    expect(text).toContain(
      "Never the work: no documents, decks, files, or captured threads. The one exception is the archive: work appears there only when the person who owns it ships it, and they can take it back.",
    );
    expect(text).toContain("Never a pass rate or a score, here or anywhere else in Lasso.");
    expect(text).toContain(
      "Never a number attached to a person",
    );
  });
});

describe("111.6 the journey is honest about whose record it is", () => {
  it("uses the thin line when the viewer can read the record", () => {
    render(<JourneySpine journey={{ enough: false, nodes: [] }} animate={false} />);
    expect(screen.getByText(JOURNEY_THIN_LINE)).toBeTruthy();
  });

  it("uses the not shared line when the record came back empty", () => {
    render(<JourneySpine journey={{ enough: false, nodes: [] }} animate={false} notShared />);
    expect(screen.getByText(JOURNEY_VIEWER_LINE)).toBeTruthy();
  });
});

describe("111.7 the write path is the server only", () => {
  it("has no client side writes to shipped_work", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(path)) continue;
        if (path.includes("shipped-work.server") || path.includes("__tests__")) continue;
        const source = readFileSync(path, "utf8");
        if (/from\(\s*["']shipped_work["']\s*\)\s*\.\s*(insert|update|delete|upsert)/.test(source)) {
          offenders.push(path);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });

  it("caps the home showcase at six", () => {
    expect(SHOWCASE_CAP).toBe(6);
  });
});
