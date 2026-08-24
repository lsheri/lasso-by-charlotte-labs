// @vitest-environment jsdom
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

import { ANALYSIS_PRESET_IDS, presetsForScope } from "@/lib/analysis-presets";
import {
  validateSpanClaim,
  type UpstreamRecord,
} from "@/lib/span-provenance.server";
import {
  countOccurrences,
  findSnippetOffset,
  sectionsFromText,
  snippetHash,
  spanIdempotencyKey,
  spanStatusLabel,
  spanVerificationLine,
} from "@/lib/span-provenance-shared";

const upstream: UpstreamRecord[] = [
  {
    id: "item-a",
    title: "Discovery call",
    text: "TURN 1 USER:\nThe margin held at nineteen percent through the quarter.\n\nTURN 2 ASSISTANT:\nUnderstood.",
    turns: [
      { id: "turn-1", turn_no: 1 },
      { id: "turn-2", turn_no: 2 },
    ],
  },
];

describe("pass 100: span provenance validation", () => {
  it("downgrades a quote that is not verbatim in the claimed item", () => {
    const claim = validateSpanClaim(
      {
        status: "exact",
        to_item_id: "item-a",
        to_turn_no: 1,
        quote: "The margin held at twenty two percent through the quarter.",
        explanation: "Made up.",
        verification: "none_in_record",
      },
      upstream,
    );
    expect(claim.status).toBe("unsourced");
    expect(claim.to_item_id).toBeNull();
    expect(claim.quote).toBeNull();
  });

  it("resolves a real turn_no to its turns row id", () => {
    const claim = validateSpanClaim(
      {
        status: "exact",
        to_item_id: "item-a",
        to_turn_no: 1,
        quote: "The margin held at nineteen percent",
        explanation: "Stated in the call.",
        verification: "none_in_record",
      },
      upstream,
    );
    expect(claim.status).toBe("exact");
    expect(claim.to_turn_id).toBe("turn-1");
  });

  it("rejects a turn_no that does not exist in the record", () => {
    const claim = validateSpanClaim(
      {
        status: "exact",
        to_item_id: "item-a",
        to_turn_no: 9,
        quote: "The margin held at nineteen percent",
        explanation: "Invented turn.",
        verification: "none_in_record",
      },
      upstream,
    );
    expect(claim.status).toBe("unsourced");
    expect(claim.to_turn_id).toBeNull();
  });

  it("keeps verification honest without a note", () => {
    const claim = validateSpanClaim(
      { status: "unsourced", verification: "found", explanation: "" },
      upstream,
    );
    expect(claim.verification).toBe("none_in_record");
    expect(spanVerificationLine(claim.verification, null)).toContain("No verification shown");
  });
});

describe("pass 100: idempotency key", () => {
  it("carries the normalized snippet hash and the sorted upstream ids", async () => {
    const a = await snippetHash("  The  Margin Held ");
    const b = await snippetHash("the margin held");
    expect(a).toBe(b);

    const key = spanIdempotencyKey({
      anchorId: "deck-1",
      unit: "slide",
      index: 3,
      snippetHash: a,
      upstreamIds: ["z-item", "a-item"],
    });
    expect(key).toBe(`span_provenance:deck-1:slide:3:${a}:with:a-item,z-item`);
  });
});

describe("pass 100: sectioning and re-anchoring", () => {
  it("labels slides only when the extraction knows slide boundaries", () => {
    const slides = sectionsFromText("## Slide 1\nOpening\n\n## Slide 2\nNumbers");
    expect(slides.map((s) => s.label)).toEqual(["Slide 1", "Slide 2"]);
    const plain = sectionsFromText("First para\n\nSecond para");
    expect(plain.map((s) => s.label)).toEqual(["Section 1", "Section 2"]);
    expect(plain[0]?.unit).toBe("section");
  });

  it("finds the right instance when the snippet appears twice", () => {
    const text = "margin held. Later on, margin held again.";
    expect(countOccurrences(text, "margin held")).toBe(2);
    const first = findSnippetOffset(text, "margin held", 1);
    const second = findSnippetOffset(text, "margin held", 2);
    expect(first?.start).toBe(0);
    expect(second?.start).toBe(23);
  });

  it("returns nothing when the snippet is gone, which is the previously asked rail", () => {
    expect(findSnippetOffset("nothing like it here", "margin held", 1)).toBeNull();
  });

  it("names the statuses the way a person reads them", () => {
    expect(spanStatusLabel("exact")).toBe("Exact match");
    expect(spanStatusLabel("paraphrase")).toBe("Paraphrase");
    expect(spanStatusLabel("unsourced")).toBe("No source in the record");
  });
});

describe("pass 100: span_provenance is never a chooser chip", () => {
  it("is absent from the preset registry ids", () => {
    expect(ANALYSIS_PRESET_IDS as readonly string[]).not.toContain("span_provenance");
  });

  it("is absent from every scope's chips", () => {
    for (const scope of ["thread", "deliverable", "engagement"] as const) {
      for (const isCoach of [true, false]) {
        expect(presetsForScope(scope, isCoach).map((p) => p.id)).not.toContain("span_provenance");
      }
    }
  });
});

describe("pass 100: reading is the access check", () => {
  /** A client that only returns rows the caller is allowed to see. */
  function clientFor(readableIds: string[]) {
    const builder = (table: string) => {
      const state: { ids: string[] } = { ids: [] };
      const api: Record<string, unknown> = {};
      const self = () => api as never;
      api["select"] = self;
      api["order"] = self;
      api["limit"] = () => ({ then: undefined, ...api, data: [] });
      api["in"] = () => api;
      api["eq"] = (_col: string, value: string) => {
        state.ids = [value];
        return api;
      };
      api["maybeSingle"] = async () => ({
        data:
          table === "work_items" && readableIds.includes(state.ids[0] as string)
            ? {
                id: state.ids[0],
                title: "The deck",
                type: "deck",
                source: "upload",
                source_vendor: null,
                source_meta: null,
                meta: { text_status: "ok", text_ref: null },
                content_ref: null,
                captured_at: "2026-01-02T00:00:00Z",
                created_at_source: null,
                work_date: null,
                ts_precision: "capture",
                owner_id: "owner-1",
                org_id: "org-1",
              }
            : null,
      });
      return api;
    };
    return { from: (table: string) => builder(table) } as never;
  }

  it("refuses a span question on work the caller cannot read", async () => {
    const { loadSpanScope } = await import("@/lib/span-audit.server");
    await expect(loadSpanScope(clientFor([]), "deck-1", "owner-1")).rejects.toThrow(
      /not available to you/,
    );
  });
});

describe("pass 100: an unreadable anchor stays honest", () => {
  const anchor = {
    id: "deck-1",
    title: "The deck",
    type: "deck",
    source: "upload",
    source_vendor: null,
    source_url: null,
    date_line: "captured 2026-01-02",
    text: null,
    text_status: "failed",
    text_note: "the file could not be opened",
    turns: [],
  };

  it("shows the title only line and the existing re-extract action for the owner", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { AnchorPane } = await import("@/components/provenance/AnchorPane");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnchorPane
          anchor={anchor}
          canEdit
          stitches={[]}
          viewerProfileId="p1"
          busy={false}
          onAsk={() => {}}
          onGoToSource={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Title only/)).toBeTruthy();
    expect(screen.getByText("Try reading it again")).toBeTruthy();
  });

  it("offers no owner action to a coach", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { AnchorPane } = await import("@/components/provenance/AnchorPane");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnchorPane
          anchor={anchor}
          canEdit={false}
          stitches={[]}
          viewerProfileId="coach-1"
          busy={false}
          onAsk={() => {}}
          onGoToSource={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Try reading it again")).toBeNull();
  });
});
