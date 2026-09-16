// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecisionRow } from "@/hooks/use-decisions";

const now = new Date("2026-09-16T08:00:00.000Z").getTime();
vi.setSystemTime(now);

const rows: DecisionRow[] = [
  {
    id: "awaiting", owner_id: "person", engagement_id: null, author: "ai_draft", call_text: "Hold the launch", situation: "The figures changed", why: "", status: "draft", srcs: [], pattern_tags: [], date_label: "16 Sep", created_at: "2026-09-16T07:00:00.000Z", resolved_at: null,
  },
  {
    id: "confirmed", owner_id: "person", engagement_id: null, author: "human", call_text: "Use the revised deck", situation: "The group needed detail", why: "It made the tradeoff clear.", status: "confirmed", srcs: [], pattern_tags: [], date_label: "15 Sep", created_at: "2026-09-15T07:00:00.000Z", resolved_at: "2026-09-15T08:00:00.000Z",
  },
  {
    id: "needs-why", owner_id: "person", engagement_id: null, author: "human", call_text: "Keep the appendix", situation: "Questions remained", why: "", status: "confirmed", srcs: [], pattern_tags: [], date_label: "1 Sep", created_at: "2026-09-01T07:00:00.000Z", resolved_at: "2026-09-01T08:00:00.000Z",
  },
];

let activeRows: DecisionRow[] = rows;

vi.mock("@/hooks/use-decisions", async (original) => {
  const actual = await original<typeof import("@/hooks/use-decisions")>();
  return {
    ...actual,
    useDecisions: () => ({ data: activeRows, isLoading: false, error: null }),
    useDecisionSourceItems: () => ({ data: {} }),
    useDecisionSourceTurns: () => ({ data: {} }),
  };
});

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: null }) }));
vi.mock("@/components/decisions/AddDecisionDialog", () => ({ AddDecisionDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger }));
vi.mock("@/components/work/ThreadViewerById", () => ({ ThreadViewerById: () => null }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { DecisionsPage, DECISION_PAGE_SIZE, decisionCounts, filterDecisions, groupDecisions } from "@/pages/DecisionsPage";

afterEach(() => {
  document.body.replaceChildren();
  activeRows = rows;
});


describe("Your calls storyboard", () => {
  it("groups entries into this week and earlier", () => {
    expect(groupDecisions(rows, now).map((group) => [group.label, group.rows.length])).toEqual([
      ["this week", 2],
      ["earlier", 1],
    ]);
  });

  it("renders awaiting and confirmed states", () => {
    render(<DecisionsPage />);
    expect(screen.getByPlaceholderText("Why was this the right call? A sentence is enough.")).toBeTruthy();
    expect(screen.getAllByText("ON THE RECORD")).toHaveLength(2);
  });

  it("shows the three truthful counts", () => {
    expect(decisionCounts(rows)).toEqual({ confirmed: 2, withReasoning: 1, awaiting: 1 });
    render(<DecisionsPage />);
    expect(screen.getByText("decisions logged").previousElementSibling?.textContent).toBe("2");
    expect(screen.getByText("carry the reasoning").previousElementSibling?.textContent).toBe("1");
    expect(screen.getByText("awaiting your review").previousElementSibling?.textContent).toBe("1");
  });

  it("filters to confirmed calls without reasoning", () => {
    expect(filterDecisions(rows, "no-why").map((row) => row.id)).toEqual(["needs-why"]);
    render(<DecisionsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Needs reasoning" }));
    expect(screen.getByText("Keep the appendix")).toBeTruthy();
    expect(screen.queryByText("Hold the launch")).toBeNull();
    expect(screen.queryByText("Use the revised deck")).toBeNull();
  });

  it("shows a page at a time and reveals the rest, with counts from the full set", () => {
    const many: DecisionRow[] = Array.from({ length: 60 }, (_, index) => ({
      ...rows[1]!,
      id: `call-${index}`,
      call_text: `Call number ${index}`,
      why: "It held up.",
    }));
    activeRows = many;
    render(<DecisionsPage />);

    expect(screen.getAllByText(/^Call number /)).toHaveLength(DECISION_PAGE_SIZE);
    expect(screen.getByText("decisions logged").previousElementSibling?.textContent).toBe("60");
    expect(screen.getByText("35 earlier")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "show earlier calls" }));
    expect(screen.getAllByText(/^Call number /)).toHaveLength(DECISION_PAGE_SIZE * 2);
    expect(screen.getByText("decisions logged").previousElementSibling?.textContent).toBe("60");

    fireEvent.click(screen.getByRole("button", { name: "show earlier calls" }));
    expect(screen.getAllByText(/^Call number /)).toHaveLength(60);
    expect(screen.queryByRole("button", { name: "show earlier calls" })).toBeNull();
  });
});
