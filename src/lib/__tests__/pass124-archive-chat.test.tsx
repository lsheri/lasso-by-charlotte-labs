// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchiveChat } from "@/components/archive/ArchiveChat";
import {
  ARCHIVE_MIN_ITEMS,
  ARCHIVE_NO_MATCH_LINE,
  ARCHIVE_TOO_SMALL_LINE,
  groundWhy,
  validateArchiveMatches,
  type ArchiveCorpusEntry,
} from "@/lib/archive-search-shared";
import type { ShippedCard } from "@/lib/shipped-work-shared";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", role: "member" } }),
}));
vi.mock("@/hooks/use-shipped-work", () => ({
  useUnshipWork: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mocks.search,
}));
vi.mock("@/lib/archive-search.functions", () => ({ searchArchive: {} }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

function card(id: string): ShippedCard {
  return {
    id: `s-${id}`,
    work_item_id: id,
    engagement_id: "e1",
    shipped_at: "2026-01-01T00:00:00Z",
    shipped_by: "p9",
    shipped_by_name: "Colleague",
    title: `Deck ${id}`,
    type: "document",
    source: null,
    source_vendor: null,
    source_meta: null,
    meta: null,
    owner_id: "p9",
    work_date: null,
    created_at_source: null,
    engagement_code: "E-1",
    client_label: "Acme",
    engagement_title: "Pricing work",
    engagement_brief: null,
    record_items: 0,
    traced_facts: 0,
  };
}

function corpusEntry(id: string, artifact: string): ArchiveCorpusEntry {
  return {
    work_item_id: id,
    title: `Deck ${id}`,
    engagement_title: "Pricing work",
    brief: null,
    artifact_text: artifact,
  };
}

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return rtlRender(ui, { wrapper });
}

afterEach(() => {
  cleanup();
  mocks.search.mockReset();
});

describe("server side validation", () => {
  const corpus = [
    corpusEntry("w1", "We started from the client's existing rate card and rebuilt the tiers."),
    corpusEntry("w2", "The team checked every figure against the signed contract."),
  ];

  it("drops ids the archive does not know, never repairs them", () => {
    const out = validateArchiveMatches(
      {
        matches: [
          { work_item_id: "ghost", why: "invented" },
          { work_item_id: "w2", why: "checks were done" },
        ],
        best_match_id: "ghost",
      },
      corpus,
    );
    expect(out.matches.map((m) => m.work_item_id)).toEqual(["w2"]);
    expect(out.best_match_id).toBe("w2");
  });

  it("clamps to six matches", () => {
    const wide = Array.from({ length: 9 }, (_, i) => corpusEntry(`x${i}`, "text about pricing"));
    const out = validateArchiveMatches(
      { matches: wide.map((e) => ({ work_item_id: e.work_item_id, why: "it is adjacent" })) },
      wide,
    );
    expect(out.matches).toHaveLength(6);
  });

  it("unquotes a fabricated quote and keeps a verbatim one", () => {
    const text = corpus[0]!.artifact_text;
    expect(groundWhy('It says "rebuilt the tiers" here.', text)).toBe(
      'It says "rebuilt the tiers" here.',
    );
    const attacked = groundWhy('It says "we tripled revenue overnight" here.', text);
    expect(attacked).toBe("It says we tripled revenue overnight here.");
    expect(attacked).not.toContain('"');
  });
});

describe("the archive chat", () => {
  it("short circuits under three pieces and never calls the model", async () => {
    render(<ArchiveChat cards={[card("w1"), card("w2")]} />);
    expect(ARCHIVE_MIN_ITEMS).toBe(3);
    fireEvent.change(screen.getByTestId("archive-chat-input"), {
      target: { value: "how do people build pricing decks here?" },
    });
    fireEvent.click(screen.getByTestId("archive-chat-send"));
    await waitFor(() => {
      expect(screen.getByTestId("archive-results").textContent).toContain(ARCHIVE_TOO_SMALL_LINE);
    });
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("says the no-match line rather than padding", async () => {
    mocks.search.mockResolvedValue({ matches: [], best_match_id: null, too_small: false });
    render(<ArchiveChat cards={[card("w1"), card("w2"), card("w3")]} />);
    fireEvent.change(screen.getByTestId("archive-chat-input"), {
      target: { value: "anything about tax" },
    });
    fireEvent.click(screen.getByTestId("archive-chat-send"));
    await waitFor(() => {
      expect(screen.getByTestId("archive-results").textContent).toContain(ARCHIVE_NO_MATCH_LINE);
    });
  });

  it("plays exactly one firework per result set, and none on re-render", async () => {
    mocks.search.mockResolvedValue({
      matches: [
        { work_item_id: "w1", why: "it rebuilt the tiers" },
        { work_item_id: "w2", why: "it shows the checks" },
      ],
      best_match_id: "w1",
      too_small: false,
    });
    const cards = [card("w1"), card("w2"), card("w3")];
    const { rerender } = render(<ArchiveChat cards={cards} />);
    fireEvent.change(screen.getByTestId("archive-chat-input"), {
      target: { value: "pricing decks" },
    });
    fireEvent.click(screen.getByTestId("archive-chat-send"));
    await waitFor(() => expect(screen.getAllByTestId("archive-result-w1").length).toBe(1));
    expect(screen.getAllByTestId("journey-firework")).toHaveLength(1);

    rerender(<ArchiveChat cards={cards} />);
    expect(screen.queryAllByTestId("journey-firework")).toHaveLength(0);
    // The results themselves survive the re-render exactly as left.
    expect(screen.getByTestId("archive-why-w1").textContent).toContain("WHY: ");
  });

  it("writes nothing anywhere: results are component state only", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mocks.search.mockResolvedValue({
      matches: [{ work_item_id: "w1", why: "it rebuilt the tiers" }],
      best_match_id: "w1",
      too_small: false,
    });
    render(<ArchiveChat cards={[card("w1"), card("w2"), card("w3")]} />);
    fireEvent.change(screen.getByTestId("archive-chat-input"), {
      target: { value: "pricing" },
    });
    fireEvent.click(screen.getByTestId("archive-chat-send"));
    await waitFor(() => expect(screen.getByTestId("archive-result-w1")).toBeTruthy());
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
