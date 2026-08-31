// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import type { ShippedCard } from "@/lib/shipped-work-shared";

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
    title: "Q2 board deck.pptx",
    type: "deck",
    source: "connector:gdrive",
    source_vendor: "gdrive",
    source_meta: null,
    meta: null,
    owner_id: "p1",
    work_date: null,
    created_at_source: null,
    engagement_code: "Art-001",
    client_label: "Artemis",
    engagement_title: "Artemis growth review",
    engagement_brief: "Find where growth stalled and say what to do about it next quarter.",
    record_items: 0,
    traced_facts: 0,
    ...over,
  };
}

describe("pass 116: the shipped card's true identity", () => {
  it("wears exactly one glyph, the format of the file the deck really is", () => {
    const { container } = render(<ShippedWorkCard card={card()} canTakeBack={false} />);
    const glyphs = container.querySelectorAll("[data-glyph]");
    expect(glyphs.length).toBe(1);
    expect(glyphs[0]?.getAttribute("data-glyph")).toBe("powerpoint");
    expect(screen.getByTestId("shipped-card-kind-w1").textContent).toBe("Deck");
  });

  it("an app deliverable wears one glyph too, never a second mark", () => {
    const { container } = render(
      <ShippedWorkCard card={card({ type: "app" })} canTakeBack={false} />,
    );
    expect(container.querySelectorAll("[data-glyph]").length).toBe(1);
    expect(screen.getByTestId("shipped-card-kind-w1").textContent).toBe("Document");
  });

  it("headlines the engagement, and falls back to the work item title", () => {
    const { container } = render(<ShippedWorkCard card={card()} canTakeBack={false} />);
    expect(container.textContent).toContain("Artemis growth review");
    cleanup();
    const fallback = render(
      <ShippedWorkCard card={card({ engagement_title: null })} canTakeBack={false} />,
    );
    expect(fallback.container.textContent).toContain("Q2 board deck.pptx");
  });

  it("shows the brief clamped to two lines, and nothing at all when absent", () => {
    render(<ShippedWorkCard card={card()} canTakeBack={false} />);
    const brief = screen.getByTestId("shipped-card-brief-w1");
    expect(brief.className).toContain("line-clamp-2");
    cleanup();
    render(<ShippedWorkCard card={card({ engagement_brief: "  " })} canTakeBack={false} />);
    expect(screen.queryByTestId("shipped-card-brief-w1")).toBeNull();
  });

  it("moves the deliverable filename into the meta line", () => {
    const { container } = render(<ShippedWorkCard card={card()} canTakeBack={false} />);
    const meta = [...container.querySelectorAll("span.font-mono")]
      .map((el) => el.textContent ?? "")
      .join(" ");
    expect(meta).toContain("Q2 board deck.pptx");
    expect(meta).toContain("Art-001");
  });
});
