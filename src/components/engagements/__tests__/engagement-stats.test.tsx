// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EngagementStats } from "@/components/engagements/EngagementStats";

vi.mock("@/hooks/use-decisions", () => ({
  useEngagementDecisions: () => ({ data: [] }),
}));

type StatTask = {
  is_board_default?: boolean | null;
  work_item_tasks: { work_items: unknown | null }[];
};

function task(pieces: number, isBoardDefault = false): StatTask {
  return {
    is_board_default: isBoardDefault,
    work_item_tasks: Array.from({ length: pieces }, () => ({ work_items: { id: "w" } })),
  };
}

afterEach(cleanup);

describe("EngagementStats and the board default home", () => {
  it("counts the default home's pieces of work but not as a workstream", () => {
    render(
      <EngagementStats
        engagementId="e1"
        tasks={[task(3), task(2), task(4, true)]}
      />,
    );
    expect(screen.getByText(/2 workstreams/)).toBeTruthy();
    expect(screen.getByText(/9 pieces of work/)).toBeTruthy();
  });

  it("still counts the default home's pieces when it is the only task", () => {
    render(<EngagementStats engagementId="e1" tasks={[task(2, true)]} />);
    expect(screen.getByText(/0 workstreams/)).toBeTruthy();
    expect(screen.getByText(/2 pieces of work/)).toBeTruthy();
  });

  it("reads rows without the flag as ordinary workstreams", () => {
    const plain = { work_item_tasks: [{ work_items: null }] };
    render(<EngagementStats engagementId="e1" tasks={[plain]} />);
    expect(screen.getByText(/1 workstream · 0 pieces of work/)).toBeTruthy();
  });
});
