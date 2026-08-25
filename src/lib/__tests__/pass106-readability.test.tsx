// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpanLegend } from "@/components/provenance/SpanLegend";
import { StitchBadge } from "@/components/provenance/StitchBadge";
import { StitchChip } from "@/components/provenance/StitchChip";
import { StitchTabs, DELETE_CONFIRM_LINE } from "@/components/provenance/StitchTabs";
import { UpstreamPane } from "@/components/provenance/UpstreamPane";
import { badgeSpots, type StitchAnchor } from "@/components/provenance/SlidesPane";
import { tabsNewestFirst } from "@/lib/span-replay";
import {
  LEGEND_LINE,
  showMeLabel,
  spanStatusPhrase,
  stitchNumbers,
  turnLabel,
} from "@/lib/span-readability";
import type { AuditPaneItem, AuditStitch } from "@/lib/span-provenance.functions";

afterEach(cleanup);

function stitch(over: Partial<AuditStitch> = {}): AuditStitch {
  return {
    id: "s1",
    status: "exact",
    question: "Where did this come from?",
    quote: "The margin held at nineteen percent",
    verification: "found",
    verification_note: "the same figure two turns later",
    to_item_id: "item-1",
    to_item_title: "CS program research",
    to_item_url: null,
    to_turn_id: "t4",
    to_turn_no: 4,
    asked_by: "p1",
    asked_by_name: "Liam",
    created_at: "2026-01-02T00:00:00.000Z",
    locator: {
      unit: "page",
      index: 1,
      snippet: "The margin held at nineteen percent",
      occurrence: 1,
    },
    ...over,
  } as AuditStitch;
}

describe("pass 106: plain language", () => {
  it("says what each status means in words", () => {
    expect(spanStatusPhrase("exact")).toBe("Word for word");
    expect(spanStatusPhrase("paraphrase")).toBe("Found, reworded");
    expect(spanStatusPhrase("unsourced")).toBe("Not found in this record");
  });

  it("labels the action by where the answer lives", () => {
    expect(showMeLabel({ to_turn_no: 4 })).toBe("Show me in the chat (turn 4)");
    expect(showMeLabel({ to_turn_no: null })).toBe("Show me in the doc");
  });

  it("uses no em dashes in the new copy", () => {
    const copy = [
      LEGEND_LINE,
      spanStatusPhrase("exact"),
      spanStatusPhrase("paraphrase"),
      spanStatusPhrase("unsourced"),
      showMeLabel({ to_turn_no: 2 }),
      showMeLabel({ to_turn_no: null }),
      turnLabel(1, "user"),
      DELETE_CONFIRM_LINE,
    ].join(" ");
    expect(copy).not.toContain("—");
  });

  it("humanizes turn labels and always calls the assistant AI", () => {
    expect(turnLabel(3, "user")).toBe("3 · You");
    expect(turnLabel(4, "assistant")).toBe("4 · AI");
    expect(turnLabel(5, "model")).toBe("5 · AI");
  });
});

describe("pass 106: badge numbering", () => {
  it("numbers by creation, not by rail order", () => {
    const list = [
      stitch({ id: "b", created_at: "2026-01-02T00:00:00.000Z" }),
      stitch({ id: "c", created_at: "2026-01-03T00:00:00.000Z" }),
      stitch({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
    ];
    const numbers = stitchNumbers(list);
    expect(numbers).toEqual({ a: 1, b: 2, c: 3 });
    // The rail still reads newest first, and the numbers do not follow it.
    expect(tabsNewestFirst(list).map((entry) => numbers[entry.id])).toEqual([3, 2, 1]);
  });

  it("places a badge at the top right of the ink", () => {
    const anchors: StitchAnchor[] = [
      {
        stitch: stitch(),
        page: 1,
        start: 0,
        end: 0,
        ink: [
          [0.1, 0.5],
          [0.6, 0.5],
          [0.6, 0.2],
        ],
      },
    ];
    const spots = badgeSpots(anchors, { runs: [], text: "", offsets: [] }, 100, 100);
    expect(spots).toEqual([{ id: "s1", x: 60, y: 20 }]);
  });

  it("shows the badge on the card and on the focused source turn", () => {
    render(<StitchChip stitch={stitch()} number={2} onGoToSource={() => {}} />);
    expect(screen.getByTestId("stitch-badge-card-s1").textContent).toBe("2");
    expect(screen.getByText("Word for word")).toBeTruthy();
    expect(screen.getByText("Show me in the chat (turn 4)")).toBeTruthy();
    cleanup();

    const item: AuditPaneItem = {
      id: "item-1",
      title: "CS program research",
      type: "chat",
      source: "mcp:claude",
      source_vendor: "claude",
      source_url: null,
      web_view_link: null,
      date_line: "2 Jan 2026",
      text: null,
      text_status: "ok",
      text_note: null,
      turns: [
        { id: "t3", turn_no: 3, role: "user", content: "What did we agree?" },
        { id: "t4", turn_no: 4, role: "assistant", content: "The margin held." },
      ],
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UpstreamPane
          items={[item]}
          baseline={[]}
          focus={{
            itemId: "item-1",
            turnId: "t4",
            token: 1,
            status: "exact",
            stitchId: "s1",
            number: 2,
          }}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("3 · You")).toBeTruthy();
    expect(screen.getByText(/4 · AI/)).toBeTruthy();
    expect(screen.getByTestId("stitch-badge-turn-s1").textContent).toBe("2");
  });

  it("keeps the chip's status wrapper class so the border and wash stay", () => {
    const { container } = render(
      <StitchChip stitch={stitch({ status: "paraphrase" })} number={1} onGoToSource={() => {}} />,
    );
    const chip = container.querySelector('[data-testid="stitch-chip-s1"]') as HTMLElement;
    expect(chip.className).toContain("nb-stitch-chip");
    expect(chip.className).toContain("nb-span-paraphrase");
    expect(chip.getAttribute("data-stitch-id")).toBe("s1");
  });

  it("scrolls the pairing into view from either badge", () => {
    const onBadgeClick = vi.fn();
    render(
      <StitchChip
        stitch={stitch()}
        number={1}
        onBadgeClick={onBadgeClick}
        onGoToSource={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("stitch-badge-card-s1"));
    expect(onBadgeClick).toHaveBeenCalled();

    const onInk = vi.fn();
    render(<StitchBadge n={1} stitchId="s1" where="ink" onClick={onInk} />);
    fireEvent.click(screen.getByTestId("stitch-badge-ink-s1"));
    expect(onInk).toHaveBeenCalled();
  });
});

describe("pass 106: legend and rail", () => {
  it("always shows the colour legend", () => {
    render(<SpanLegend />);
    expect(screen.getByTestId("span-legend").textContent).toContain(LEGEND_LINE);
  });

  it("gives the owner Remove behind the tab menu, anchored to the tab", () => {
    render(
      <StitchTabs
        stitches={[stitch()]}
        activeId={null}
        canDelete
        onSelect={() => {}}
        onNew={() => {}}
        onCopyLink={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText("Where did this come from")).toBeTruthy();
    expect(screen.queryByTestId("stitch-tab-copy-s1")).toBeNull();
    fireEvent.click(screen.getByTestId("stitch-tab-menu-s1"));
    expect(screen.getByTestId("stitch-tab-copy-s1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("stitch-tab-delete-s1"));
    const confirm = screen.getByTestId("stitch-tab-confirm-s1");
    expect(confirm.textContent).toContain(DELETE_CONFIRM_LINE);
    // The confirm lives inside the tab's own menu, not floating elsewhere.
    expect(screen.getByTestId("stitch-tab-overflow-s1").contains(confirm)).toBe(true);
  });

  it("never offers a coach the delete affordance", () => {
    render(
      <StitchTabs
        stitches={[stitch()]}
        activeId={null}
        canDelete={false}
        onSelect={() => {}}
        onNew={() => {}}
        onCopyLink={() => {}}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("stitch-tab-menu-s1"));
    expect(screen.getByTestId("stitch-tab-copy-s1")).toBeTruthy();
    expect(screen.queryByTestId("stitch-tab-delete-s1")).toBeNull();
  });
});
