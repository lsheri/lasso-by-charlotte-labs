// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRowMenuParts } from "@/components/work/RowMenu";
import { MarkBriefDialog } from "@/components/work/MarkBriefDialog";
import type { WorkItemRow } from "@/lib/work-types";

const TASKS = [
  { id: "t1", name: "Market sizing", engagement_id: "e1" },
  { id: "t2", name: "Pricing review", engagement_id: "e2" },
];

vi.mock("@/components/decisions/DraftDecisionsButton", () => ({
  useDraftDecisions: () => ({ busy: false, draft: vi.fn() }),
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/components/work/use-stand-alone", () => ({
  useStandAlone: () => ({ busy: false, set: vi.fn() }),
}));
vi.mock("@/hooks/use-engagements", () => ({
  useEngagements: () => ({
    data: [
      { id: "e1", title: "Alpha board", code: "ALP-01" },
      { id: "e2", title: "Beta board", code: "BET-01" },
    ],
  }),
}));
vi.mock("@/hooks/use-briefs", () => ({
  useBriefs: () => ({ data: [] }),
  setBriefRole: vi.fn(),
  useInvalidateBriefs: () => vi.fn(),
}));
vi.mock("@/lib/clients", () => ({
  engagementLabel: (e: { title: string }) => e.title,
}));
// The fake honours the engagement filter so the test proves the query asks for one board.
vi.mock("@/integrations/supabase/client", () => {
  const make = (rows: typeof TASKS) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = (col: string, val: string) => make(col === "engagement_id" ? rows.filter((r) => r.engagement_id === val) : rows);
    q.order = () => q;
    q.then = (res: (v: unknown) => unknown) => res({ data: rows, error: null });
    return q;
  };
  return { supabase: { from: () => make(TASKS) } };
});

afterEach(cleanup);

const item = {
  id: "w1", title: "Scope doc", type: "document", source: "upload", visibility: "unmapped",
  owner_id: "p1", meta: {}, work_item_tasks: [],
} as unknown as WorkItemRow;

function Menu({ engagementId }: { engagementId?: string }) {
  const { items } = useRowMenuParts({ item, engagementId });
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent>{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("I2 — a brief belongs to the board it briefs", () => {
  it("offers Mark as the brief only inside a board", () => {
    render(<Menu />);
    expect(screen.queryByText("Mark as the brief")).toBeNull();
    cleanup();
    render(<Menu engagementId="e1" />);
    expect(screen.getByText("Mark as the brief")).toBeTruthy();
  });

  it("the picker offers this board and its workstreams, never another board", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MarkBriefDialog item={item} engagementId="e1" open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Market sizing")).toBeTruthy();
    expect(screen.getByText("The whole workboard")).toBeTruthy();
    expect(screen.getAllByText("Alpha board").length).toBeGreaterThan(0);
    expect(screen.queryByText("Beta board")).toBeNull();
    expect(screen.queryByText("Pricing review")).toBeNull();
    expect(screen.queryByText(/Create a workboard first/)).toBeNull();
  });
});
