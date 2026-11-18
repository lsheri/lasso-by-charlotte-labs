// @vitest-environment jsdom
// 17 Nov, firm brain PR 6: the red pen dialog shows the last check, runs a new one, and lists unsupported claims
// first with plain hints; a sourced claim opens its quote.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RedPenResult } from "@/lib/red-pen-shared";

const m = vi.hoisted(() => ({ latest: vi.fn(), run: vi.fn(), logEvent: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/red-pen.functions", () => ({ latestRedPen: (...a: unknown[]) => m.latest(...a), runRedPenFn: (...a: unknown[]) => m.run(...a) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.logEvent(...a) }));

import { RedPenPanel } from "@/components/canvas-lab/RedPenPanel";

const result: RedPenResult = {
  itemId: "deck",
  checkedAt: "2026-11-17T12:00:00Z",
  sourcesRead: 3,
  counts: { sourced: 1, weak: 1, unsupported: 1 },
  claims: [
    { snippet: "Specialist referrals leak at 38 percent.", slide: 2, grade: "sourced", sourceItemId: "sizing", sourceTitle: "Market sizing sheet", quote: "leakage for specialist referrals: 38 percent", note: "Same figure." },
    { snippet: "A single front door would recover most of the leakage.", slide: 4, grade: "unsupported", sourceItemId: null, sourceTitle: null, quote: null, note: "" },
    { snippet: "GLP-1 prescribing doubled.", slide: 3, grade: "weak", sourceItemId: "interview", sourceTitle: "Interview: CMO", quote: "maybe 60 percent over two years", note: "60 percent, not doubled." },
  ],
};

function open() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RedPenPanel itemId="deck" title="Opportunity readout" profileId="p1" orgId="org" onClose={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  m.latest.mockReset();
  m.run.mockReset();
  m.logEvent.mockReset();
});
afterEach(cleanup);

describe("the red pen dialog", () => {
  it("shows the last check, unsupported first", async () => {
    m.latest.mockResolvedValue(result);
    open();
    await waitFor(() => expect(document.querySelectorAll("[data-red-pen-claim]")).toHaveLength(3));
    expect([...document.querySelectorAll("[data-red-pen-claim]")].map((node) => node.getAttribute("data-red-pen-claim"))).toEqual(["unsupported", "weak", "sourced"]);
    expect(screen.getByText("Nothing on this board says this.")).toBeTruthy();
    expect(document.querySelector("[data-red-pen-summary]")!.textContent).toContain("1 unsupported, 1 weak, 1 sourced");
    expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
  });

  it("runs a check when there is none yet", async () => {
    m.latest.mockResolvedValue(null);
    m.run.mockResolvedValue(result);
    open();
    await waitFor(() => expect(screen.getByRole("button", { name: "Check this deliverable" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Check this deliverable" }));
    await waitFor(() => expect(document.querySelectorAll("[data-red-pen-claim]")).toHaveLength(3));
    expect(m.run).toHaveBeenCalledWith({ data: { item_id: "deck", profile_id: "p1" } });
  });
});
