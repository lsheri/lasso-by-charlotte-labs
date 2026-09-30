// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRowMenuParts } from "@/components/work/RowMenu";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/components/decisions/DraftDecisionsButton", () => ({
  useDraftDecisions: () => ({ busy: false, draft: vi.fn() }),
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: null }) }));
vi.mock("@/components/work/use-stand-alone", () => ({
  useStandAlone: () => ({ busy: false, set: vi.fn() }),
}));
vi.mock("@/components/work/MarkBriefDialog", () => ({ MarkBriefDialog: () => null }));

afterEach(cleanup);

const item = {
  id: "w1",
  title: "A conversation",
  type: "ai_thread",
  source: "mcp:claude",
  visibility: "unmapped",
  owner_id: "p1",
  meta: {},
  work_item_tasks: [],
} as unknown as WorkItemRow;

function Menu({ engagementId }: { engagementId?: string }) {
  const { items } = useRowMenuParts({ item, onFluency: vi.fn(), engagementId });
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent>{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("I1 — AI actions need tied context", () => {
  it("offers neither decisions nor analyse without an engagement", () => {
    render(<Menu />);
    // I2: Mark as the brief also needs a board now, so it is absent here too.
    expect(screen.queryByText("Mark as the brief")).toBeNull();
    expect(screen.queryByText("Find decisions in this conversation")).toBeNull();
    expect(screen.queryByText("Analyse this conversation")).toBeNull();
  });

  it("offers both inside an engagement, so the board keeps them", () => {
    render(<Menu engagementId="e1" />);
    expect(screen.getByText("Find decisions in this conversation")).toBeTruthy();
    expect(screen.getByText("Analyse this conversation")).toBeTruthy();
  });
});
