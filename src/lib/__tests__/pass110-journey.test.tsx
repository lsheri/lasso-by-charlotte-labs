// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JourneySpine } from "@/components/journey/JourneyView";
import {
  JOURNEY_MIN_UPSTREAM,
  JOURNEY_THIN_LINE,
  buildJourney,
  compareJourneyItems,
  journeyTypeLabel,
  providerDate,
  type JourneyItemInput,
} from "@/lib/journey";
import {
  JOURNEY_UNAVAILABLE_LINE,
  handleJourneyLink,
  journeyLinkFor,
  readJourneyId,
  stripJourneyParam,
} from "@/lib/journey-link";

afterEach(cleanup);

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

function item(over: Partial<JourneyItemInput> & { id: string }): JourneyItemInput {
  return {
    title: `Item ${over.id}`,
    type: "document",
    captured_at: "2026-01-10T00:00:00.000Z",
    ...over,
  };
}

describe("pass 110: the spine holds only what the record holds", () => {
  it("puts origins first, conversations next, and the deliverable last", () => {
    const journey = buildJourney({
      anchorId: "d",
      items: [
        item({ id: "d", type: "deck", title: "Board deck" }),
        item({ id: "c", type: "ai_thread", title: "Working session" }),
        item({ id: "a", type: "email", title: "Kickoff mail" }),
      ],
    });
    expect(journey.enough).toBe(true);
    expect(journey.nodes.map((n) => n.id)).toEqual(["a", "c", "d"]);
    expect(journey.nodes.map((n) => n.kind)).toEqual(["origin", "conversation", "deliverable"]);
  });

  it("orders by provider date, then workflow order, then capture", () => {
    const dated = buildJourney({
      anchorId: "d",
      items: [
        item({ id: "d", type: "deck" }),
        item({ id: "b", work_date: "2026-02-02" }),
        item({ id: "a", created_at_source: "2026-01-01" }),
        item({ id: "z" }),
      ],
      order: { z: 1, a: 5, b: 9 },
    });
    // a and b both carry provider dates, so those decide between them; the
    // undated z falls to the confirmed workflow order.
    expect(dated.nodes.map((n) => n.id)).toEqual(["z", "a", "b", "d"]);

    const undated = [item({ id: "p" }), item({ id: "q" })];
    expect(compareJourneyItems(undated[0]!, undated[1]!, { p: 2, q: 1 })).toBeGreaterThan(0);
    expect(compareJourneyItems(undated[0]!, undated[1]!, {})).toBeLessThan(0);
  });

  it("never invents a date", () => {
    expect(providerDate(item({ id: "a" }))).toBeNull();
    expect(providerDate(item({ id: "a", created_at_source: "2026-03-03" }))).toBe("2026-03-03");
    const journey = buildJourney({
      anchorId: "d",
      items: [item({ id: "d" }), item({ id: "a" }), item({ id: "b" })],
    });
    expect(journey.nodes.every((n) => n.date === null)).toBe(true);
  });

  it("hangs each stitch off the conversation it actually points at", () => {
    const journey = buildJourney({
      anchorId: "d",
      items: [
        item({ id: "d", type: "deck" }),
        item({ id: "c1", type: "ai_thread" }),
        item({ id: "c2", type: "ai_thread" }),
      ],
      order: { c1: 1, c2: 2 },
      stitches: [
        {
          id: "s1",
          status: "exact",
          quote: "the margin held",
          to_item_id: "c2",
          to_turn_no: 4,
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "s2",
          status: "paraphrase",
          quote: null,
          to_item_id: "nowhere",
          to_turn_no: null,
          created_at: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "s3",
          status: "unsourced",
          quote: null,
          to_item_id: null,
          to_turn_no: null,
          created_at: "2026-01-03T00:00:00.000Z",
        },
      ],
    });
    const byId = Object.fromEntries(journey.nodes.map((n) => [n.id, n]));
    expect(byId["c2"]!.stitches.map((s) => s.id)).toEqual(["s1"]);
    expect(byId["c1"]!.stitches).toEqual([]);
    expect(byId["d"]!.stitches).toEqual([]);
  });

  it("refuses a thin record rather than drawing theatre", () => {
    expect(JOURNEY_MIN_UPSTREAM).toBe(2);
    const journey = buildJourney({
      anchorId: "d",
      items: [item({ id: "d" }), item({ id: "a" })],
    });
    expect(journey.enough).toBe(false);
    expect(journey.nodes).toEqual([]);
    render(<JourneySpine journey={journey} animate={false} />);
    expect(screen.getByText(JOURNEY_THIN_LINE)).toBeTruthy();
    expect(JOURNEY_THIN_LINE.includes("—")).toBe(false);
  });

  it("speaks one line of type vocabulary", () => {
    expect(journeyTypeLabel("email")).toBe("Email");
    expect(journeyTypeLabel("ai_thread")).toBe("Conversation");
    expect(journeyTypeLabel("deck")).toBe("Deck");
    expect(journeyTypeLabel("sheet")).toBe("Document");
  });
});

function fullJourney() {
  return buildJourney({
    anchorId: "d",
    items: [
      item({ id: "d", type: "deck", title: "Board deck", work_date: "2026-03-01" }),
      item({ id: "c", type: "ai_thread", title: "Working session", turn_count: 12 }),
      item({ id: "a", type: "email", title: "Kickoff mail", created_at_source: "2026-01-05" }),
    ],
    order: { a: 1, c: 2 },
    stitches: [
      {
        id: "s1",
        status: "exact",
        quote: "the margin held at nineteen percent",
        to_item_id: "c",
        to_turn_no: 4,
        created_at: "2026-01-06T00:00:00.000Z",
      },
    ],
  });
}

describe("pass 110: the view says only what the record says", () => {
  it("renders verbatim titles, real dates, turns, and stitch status", () => {
    render(<JourneySpine journey={fullJourney()} animate={false} />);
    expect(screen.getByText("Board deck")).toBeTruthy();
    expect(screen.getByText("Kickoff mail")).toBeTruthy();
    expect(screen.getByText(/12 turns/)).toBeTruthy();
    expect(screen.getByText(/the margin held at nineteen percent/)).toBeTruthy();
    expect(screen.getByText(/Word for word/)).toBeTruthy();
  });

  it("carries no person vocabulary at all", () => {
    const { container } = render(<JourneySpine journey={fullJourney()} animate={false} />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const banned of ["prompt", "efficiency", "score", "rating", "streak", "productiv"]) {
      expect(text.includes(banned)).toBe(false);
    }
  });

  it("renders fully drawn and static when motion is not wanted", () => {
    const { container } = render(<JourneySpine journey={fullJourney()} animate={false} />);
    const nodes = container.querySelectorAll(".nb-journey-node");
    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach((node) => {
      expect(node.classList.contains("nb-journey-node-static")).toBe(true);
      expect((node as HTMLElement).style.animationDelay).toBe("");
    });
    expect(container.querySelectorAll(".nb-journey-seg").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".nb-journey-tendril").length).toBe(1);
    expect(container.querySelector(".nb-journey")?.classList.contains("is-skipped")).toBe(true);
  });

  it("colours a stitch only through the status tokens", () => {
    const { container } = render(<JourneySpine journey={fullJourney()} animate={false} />);
    const chip = container.querySelector(".nb-span");
    expect(chip?.className).toContain("nb-span-exact");
  });
});

describe("pass 110: the shareable link", () => {
  it("round trips the item id and strips itself", () => {
    const url = journeyLinkFor("https://app.example.com/", "eng-1", "item-9");
    expect(url).toBe("https://app.example.com/engagements/eng-1?journey=item-9");
    expect(readJourneyId("?journey=item-9")).toBe("item-9");
    expect(readJourneyId("?other=1")).toBeNull();
    expect(stripJourneyParam("/engagements/eng-1?journey=item-9&tab=2")).toBe(
      "/engagements/eng-1?tab=2",
    );
    expect(stripJourneyParam("/engagements/eng-1?journey=item-9")).toBe("/engagements/eng-1");
  });

  it("opens what the reader can read and says so plainly when they cannot", async () => {
    const open = vi.fn();
    const said: string[] = [];
    await handleJourneyLink({
      itemId: "item-9",
      engagementId: "eng-1",
      fetchItem: async () => ({ id: "item-9", title: "Board deck" }),
      open,
      onUnavailable: (line) => said.push(line),
    });
    expect(open).toHaveBeenCalledWith({
      anchorId: "item-9",
      anchorTitle: "Board deck",
      engagementId: "eng-1",
    });

    await handleJourneyLink({
      itemId: "item-9",
      engagementId: "eng-1",
      fetchItem: async () => null,
      open,
      onUnavailable: (line) => said.push(line),
    });
    expect(said).toEqual([JOURNEY_UNAVAILABLE_LINE]);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
