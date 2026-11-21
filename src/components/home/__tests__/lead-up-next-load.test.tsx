// @vitest-environment jsdom
// 21 Nov 2026, QA L2 of PR 299: a failed read of what someone leads never puts a red line on their Home. Someone not
// known to lead sees nothing; a lead whose list is already here keeps it, with one quiet line.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state: { value: Record<string, unknown> } = { value: {} };
vi.mock("@/components/home/use-led", () => ({ useLed: () => state.value }));
vi.mock("@/lib/lead-view.functions", () => ({ leadDocumentFn: vi.fn() }));
vi.mock("@/components/home/LeadDocumentDialog", () => ({ LeadDocumentDialog: () => null }));
vi.mock("@/components/work/use-capture-files", () => ({ useCaptureFiles: () => ({ captureWithResult: vi.fn() }) }));
vi.mock("@/lib/proposal-final.functions", () => ({ chooseFinalFn: vi.fn(), draftFinalFn: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));

import { LeadUpNext } from "@/components/home/LeadUpNext";
import { LEAD_VIEW_COPY } from "@/lib/lead-view-shared";

afterEach(cleanup);

const list = {
  goalHours: 72,
  proposals: [{ id: "p1", title: "Review", clientName: "Larkspur", ownerName: "Maren", receivedAt: "2026-11-20T12:00:00Z", sentAt: null, dueOn: null, brief: null, documents: null, documentCount: 0, pastWork: [] }],
};

describe("Up next when the read fails", () => {
  it("someone not known to lead sees nothing at all", () => {
    state.value = { isError: true, data: undefined, refetch: vi.fn() };
    const { container } = render(<LeadUpNext profileId="me" />);
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a lead keeps their list, with a quiet line and no alert", () => {
    state.value = { isError: true, data: list, refetch: vi.fn() };
    render(<LeadUpNext profileId="me" />);
    expect(screen.getByTestId("lead-up-next")).toBeTruthy();
    expect(screen.getByText(LEAD_VIEW_COPY.stale)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
