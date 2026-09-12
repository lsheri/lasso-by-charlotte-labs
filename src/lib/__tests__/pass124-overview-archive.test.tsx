// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render as rtlRender, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarNav } from "@/components/layout/SidebarNav";
import { PAST_WORK_NAV_LABEL } from "@/lib/past-work-shared";
import { navGroups, coachNavGroups } from "@/components/layout/nav-config";
import { OverviewWork } from "@/components/overview/OverviewWork";
import { ArchivePile } from "@/components/archive/ArchivePile";
import { scatterFor } from "@/components/work/pile-scatter";
import {
  LOCKED_EMPTY_LINE,
  OPEN_EMPTY_LINE,
  partitionDeliverables,
  type DeliverableCardRow,
} from "@/lib/overview-work-shared";
import type { ShippedCard } from "@/lib/shipped-work-shared";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", role: "member", org_type: "company", display_name: "A" } as {
    id: string;
    role: string;
    org_type: string;
    display_name: string;
  } | null,
  deliverables: [] as DeliverableCardRow[],
  shipped: [] as ShippedCard[],
}));

vi.mock("@/hooks/use-profile", () => ({
  isBusinessOrg: (p: { org_type: string } | null | undefined) => p?.org_type === "company",
  useProfile: () => ({ data: mocks.profile }),
}));
vi.mock("@/hooks/use-my-deliverables", () => ({
  useMyDeliverables: () => ({ data: mocks.deliverables }),
}));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [] }) }));
vi.mock("@/hooks/use-decisions", () => ({ useDecisions: () => ({ data: [] }) }));
vi.mock("@/hooks/use-shipped-work", () => ({
  useShippedWork: () => ({ data: mocks.shipped, isLoading: false }),
  useUnshipWork: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params: _params,
    activeProps: _activeProps,
    children,
    ...rest
  }: {
    to: string;
    params?: unknown;
    activeProps?: unknown;
    children: React.ReactNode;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

function row(over: Partial<DeliverableCardRow> & { id: string }): DeliverableCardRow {
  return {
    name: `Deliverable ${over.id}`,
    status: "open",
    delivered_at: null,
    accepted_at: null,
    engagement_id: "e1",
    engagement_title: "Pricing work",
    engagement_code: "E-1",
    client_label: "Acme",
    shipped: false,
    ...over,
  };
}

function card(id: string): ShippedCard {
  return {
    id: `s-${id}`,
    work_item_id: id,
    engagement_id: "e1",
    shipped_at: "2026-01-0" + id.slice(-1) + "T00:00:00Z",
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

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return rtlRender(ui, { wrapper });
}

afterEach(() => {
  cleanup();
  mocks.profile = { id: "p1", role: "member", org_type: "company", display_name: "A" };
  mocks.deliverables = [];
  mocks.shipped = [];
});

describe("open vs locked partition, against the real tasks.status source", () => {
  it("locks delivered, accepted and shipped, keeps open open, drops set aside", () => {
    const { open, locked } = partitionDeliverables([
      row({ id: "a", status: "open" }),
      row({ id: "b", status: "delivered", delivered_at: "2026-01-01" }),
      row({ id: "c", status: "accepted", accepted_at: "2026-01-02" }),
      row({ id: "d", status: "set_aside" }),
      row({ id: "e", status: "open", shipped: true }),
      // Legacy rows read as open, exactly as the firm view normalises them.
      row({ id: "f", status: "active" }),
    ]);
    expect(open.map((r) => r.id)).toEqual(["a", "f"]);
    expect(locked.map((r) => r.id)).toEqual(["b", "c", "e"]);
  });
});

describe("the Overview sections", () => {
  it("keeps a locked title at full opacity, unstruck, with a check and a fold", () => {
    mocks.deliverables = [row({ id: "b", status: "delivered" })];
    render(<OverviewWork />);
    const title = screen.getByTestId("deliverable-title-b");
    expect(title.className).toContain("nb-locked-title");
    expect(title.className).not.toMatch(/line-through/);
    expect(screen.getByTestId("deliverable-card-b").dataset["locked"]).toBe("1");
    expect(screen.getAllByTestId("graphite-check").length).toBe(1);
    expect(screen.getByTestId("deliverable-fold-b")).toBeTruthy();
  });

  it("says the empty states word for word", () => {
    render(<OverviewWork />);
    expect(screen.getByTestId("overview-open-empty").textContent).toBe(OPEN_EMPTY_LINE);
    expect(screen.getByTestId("overview-locked-empty").textContent).toBe(LOCKED_EMPTY_LINE);
  });

  it("puts no green on a locked card", () => {
    mocks.deliverables = [row({ id: "b", status: "accepted" })];
    render(<OverviewWork />);
    expect(screen.getByTestId("deliverable-card-b").className).not.toContain("accent");
  });
});

describe("the archive in the nav", () => {
  // Pass 138.1: the archive is reached from the What you learned group, labelled
  // "Past work", for members and admins. Coaches are engagement-scoped guests
  // and do not see the firm archive in their nav.
  it("is in the What you learned group for members and admins, not coaches", () => {
    // Nav is now ordered by the weekly loop rather than by object type.
    const learned = navGroups.find((group) => group.label === "What you learned");
    expect(learned?.items.some((item) => item.to === "/archive")).toBe(true);
    expect(
      coachNavGroups.some((group) => group.items.some((item) => item.to === "/archive")),
    ).toBe(false);

    render(<SidebarNav />);
    expect(screen.getByText(PAST_WORK_NAV_LABEL)).toBeTruthy();
    cleanup();

    mocks.profile = { id: "p2", role: "admin", org_type: "company", display_name: "B" };
    render(<SidebarNav />);
    expect(screen.getByText(PAST_WORK_NAV_LABEL)).toBeTruthy();
    cleanup();

    mocks.profile = { id: "p3", role: "coach", org_type: "company", display_name: "C" };
    render(<SidebarNav />);
    expect(screen.queryByText(PAST_WORK_NAV_LABEL)).toBeNull();
  });
});

describe("the pile is seeded by id", () => {
  it("holds the same transform whether or not a search happened", () => {
    const cards = [card("w1"), card("w2"), card("w3")];
    const { rerender } = render(<ArchivePile cards={cards} />);
    const before = cards.map(
      (c) => screen.getByTestId(`archive-pile-item-${c.work_item_id}`).getAttribute("style") ?? "",
    );

    // Hidden behind a result set, then browsed back to: nothing re-scatters.
    rerender(<ArchivePile cards={cards} hidden />);
    rerender(<ArchivePile cards={[...cards].reverse()} />);
    const after = cards.map(
      (c) => screen.getByTestId(`archive-pile-item-${c.work_item_id}`).getAttribute("style") ?? "",
    );
    expect(after).toEqual(before);
    expect(before[0]).toContain(`${scatterFor("s-w1").rot}deg`);
  });
});
