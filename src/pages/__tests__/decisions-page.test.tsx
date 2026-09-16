// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecisionRow } from "@/hooks/use-decisions";

const now = new Date("2026-09-16T08:00:00.000Z").getTime();
vi.setSystemTime(now);

const rows: DecisionRow[] = [
  {
    id: "awaiting", owner_id: "person", engagement_id: null, author: "lasso", call_text: "Hold the launch", situation: "The figures changed", why: "", status: "draft", srcs: [], pattern_tags: [], date_label: "16 Sep", created_at: "2026-09-16T07:00:00.000Z", resolved_at: null,
  },
  {
    id: "confirmed", owner_id: "person", engagement_id: null, author: "human", call_text: "Use the revised deck", situation: "The group needed detail", why: "It made the tradeoff clear.", status: "confirmed", srcs: [], pattern_tags: [], date_label: "15 Sep", created_at: "2026-09-15T07:00:00.000Z", resolved_at: "2026-09-15T08:00:00.000Z",
  },
  {
    id: "needs-why", owner_id: "person", engagement_id: null, author: "human", call_text: "Keep the appendix", situation: "Questions remained", why: "", status: "confirmed", srcs: [], pattern_tags: [], date_label: "1 Sep", created_at: "2026-09-01T07:00:00.000Z", resolved_at: "2026-09-01T08:00:00.000Z",
  },
];

vi.mock("@/hooks/use-decisions", async (original) => {
  const actual = await original<typeof import("@/hooks/use-decisions")>();
  return {
    ...actual,
    useDecisions: () => ({ data: rows, isLoading: false, error: null }),
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

import { DecisionsPage, decisionCounts, filterDecisions, groupDecisions } from "@/pages/DecisionsPage";

afterEach(() => document.body.replaceChildren());

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
    expect(screen.getByText("ON THE RECORD")).toBeTruthy();
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
});