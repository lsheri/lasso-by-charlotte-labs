// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("pass 103.1 nits", () => {
  it("paints slide highlights as a wash you can read through", () => {
    const pane = readFileSync("src/components/provenance/SlidesPane.tsx", "utf8");
    expect(pane).toContain("fillOpacity={0.35}");
    expect(pane).toContain('mixBlendMode: "multiply"');
  });

  it("says nothing about tools until the coverage query resolves", () => {
    const src = readFileSync("src/components/common/CaptureCoverage.tsx", "utf8");
    expect(src).toContain("isPending");
    expect(src).toMatch(/!data \|\| isPending\s*\n?\s*\? ""/);
  });

  it("only treats a real owner match as owned in the peek", () => {
    const src = readFileSync("src/components/peek/PeekPanel.tsx", "utf8");
    expect(src).not.toContain("!active.owner_id ||");
    expect(src).toContain("active.owner_id === viewerProfileId");
  });

  it("keeps owner_id in every select that feeds the peek", () => {
    // client_id now sits between owner_id and title: the coarse claim rides
    // along in the same read, so the assertion checks owner_id alone.
    expect(readFileSync("src/hooks/use-work-items.ts", "utf8")).toContain("id, owner_id, client_id");
    expect(readFileSync("src/lib/engagement-page.server.ts", "utf8")).toContain(
      "work_items(id, owner_id",
    );
  });

  it("writes verification_note only for found rows", () => {
    const src = readFileSync("src/lib/span-provenance.server.ts", "utf8");
    expect(src).toContain(
      'verification_note: claim.verification === "found" ? claim.verification_note : null,',
    );
    expect(src).not.toContain("claim.verification_note ?? claim.explanation");
  });

  it("has no reference left to the retired spinning spider", () => {
    const spider = readFileSync("src/components/notebook/SpiderMark.tsx", "utf8");
    expect(spider).not.toContain("spi" + "n.gif");
  });
});

vi.mock("@/lib/profile-resolve", () => ({
  resolveProfile: async () => ({ id: "p1", org_id: "o1", role: "member" }),
}));
vi.mock("../profile-resolve", () => ({
  resolveProfile: async () => ({ id: "p1", org_id: "o1", role: "member" }),
}));

const existingRow = {
  id: "link-1",
  from_item_id: "item-1",
  locator: { unit: "slide", index: 3, snippet: "The  Margin   Story", occurrence: 1 },
  question: "Where did this come from?",
  to_item_id: "item-2",
  to_turn_id: null,
  quote: "the margin story",
  status: "exact",
  verification: "none_in_record",
  verification_note: null,
  asked_by: "p1",
  created_at: "2026-01-01T00:00:00Z",
};

describe("duplicate stitch guard", () => {
  it("returns the existing row without a model call or a new insert", async () => {
    const insert = vi.fn();
    const supabase = {
      from(table: string) {
        if (table === "work_items") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "item-1", title: "Deck", owner_id: "p1", org_id: "o1" },
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ order: async () => ({ data: [existingRow] }) }) }),
          insert,
        };
      },
    };

    const { runSpanProvenance } = await import("../span-provenance.server");
    const result = await runSpanProvenance(supabase as never, "user-1", {
      workItemId: "item-1",
      locator: { unit: "slide", index: 3, snippet: "the margin story", occurrence: 1 },
    });

    expect(result.id).toBe("link-1");
    expect(insert).not.toHaveBeenCalled();
  });
});
