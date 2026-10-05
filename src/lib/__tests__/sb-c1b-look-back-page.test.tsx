// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", role: "member" } }),
}));
vi.mock("@/hooks/use-shipped-work", () => ({
  useShippedWork: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/lib/role-access", () => ({ usesGuestNav: () => false }));
vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, italicWord }: { title: string; italicWord?: string }) => (
    <h1>{title} {italicWord}</h1>
  ),
}));
vi.mock("@/components/archive/ArchiveSpine", () => ({
  ArchiveSpine: () => <div data-testid="archive-spine" />,
}));
vi.mock("@/components/archive/ArchivedSection", () => ({
  ArchivedSection: () => <section data-testid="archived-section">Archived</section>,
}));
vi.mock("@/components/archive/PastWorkSearch", () => ({
  PastWorkSearch: () => <div data-testid="past-work-search" />,
}));
vi.mock("@/components/archive/ArchiveChat", () => ({
  ArchiveChat: () => <div data-testid="archive-chat" />,
}));
vi.mock("@/components/notebook/ToneCard", () => ({
  ToneCard: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <article data-testid="tone-card" aria-label={label}>{children}</article>
  ),
}));

import { ArchivePage } from "@/pages/ArchivePage";

afterEach(cleanup);

describe("SB-C1b-2 Look back page", () => {
  it("renders the new H1 and all five blocks in the required DOM order", () => {
    const { container } = render(<ArchivePage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Look back");

    const header = screen.getByRole("heading", { level: 1 });
    const shipped = screen.getByTestId("shipped-work-section");
    const archived = screen.getByTestId("archived-section");
    const ask = screen.getByText("ASK PAST WORK").closest("section");
    const tones = container.querySelector("aside");
    expect(ask).not.toBeNull();
    expect(tones).not.toBeNull();

    const ordered = [header, shipped, archived, ask as HTMLElement, tones as HTMLElement];
    for (let index = 0; index < ordered.length - 1; index += 1) {
      expect(
        ordered[index]!.compareDocumentPosition(ordered[index + 1]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getAllByTestId("tone-card")).toHaveLength(3);
  });
});