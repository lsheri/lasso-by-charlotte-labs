// @vitest-environment jsdom
// 18 Nov 2026, founder AI costs: the /founder/costs page with its server function mocked. Loading, empty, refused
// (a 403 shows nothing about costs) and filled, with expandable people and the range picker.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_COSTS_COPY as C, type AiCostReport } from "@/lib/ai-costs-shared";

const m = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/ai-costs.functions", () => ({ getAiCostReport: (...a: unknown[]) => m.load(...a) }));

import { AiCostsPage, isRefusal } from "@/components/founder/AiCostsPage";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AiCostsPage />
    </QueryClientProvider>,
  );
}

const range = { from: "2026-11-11T12:00:00.000Z", to: "2026-11-18T12:00:00.000Z", label: "Last 7 days" };

const filled: AiCostReport = {
  range,
  totals: { calls: 1234, costUsd: 14.01 },
  firms: [
    {
      orgId: "o1",
      name: "Kestrel Bay",
      calls: 1200,
      costUsd: 13.5,
      people: 2,
      persons: [
        { profileId: "p1", name: "Harper Quinn", calls: 1000, costUsd: 12 },
        { profileId: null, name: C.systemCalls, calls: 200, costUsd: 1.5 },
      ],
    },
    { orgId: null, name: C.noWorkspace, calls: 34, costUsd: 0.0031, people: 0, persons: [] },
  ],
  surfaces: [{ surface: "firm_ask", calls: 1234, costUsd: 14.01, avgCostUsd: 0.011353 }],
  daily: [
    { day: "2026-11-17", calls: 1000, costUsd: 10 },
    { day: "2026-11-18", calls: 234, costUsd: 4.01 },
  ],
};

beforeEach(() => {
  m.load.mockReset();
});
afterEach(cleanup);

describe("AiCostsPage", () => {
  it("shows a loading line while the report is on its way, asking for the last 7 days", async () => {
    m.load.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect((screen.getByRole("status")).textContent).toContain(C.loading);
    expect(m.load).toHaveBeenCalledWith({ data: { days: 7 } });
  });

  it("says so plainly when the range has no calls", async () => {
    m.load.mockResolvedValue({ ...filled, totals: { calls: 0, costUsd: 0 }, firms: [], surfaces: [], daily: [] });
    renderPage();
    expect(await screen.findByText(C.empty)).toBeTruthy();
    expect(screen.queryByText(C.firms)).toBeNull();
  });

  it("shows only the refusal line on a 403, with no costs, tables or range picker", async () => {
    m.load.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toContain(C.refused);
    expect(screen.queryByText(C.title)).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$/);
  });

  it("treats a signed-out error as refused too, and any other failure as a retryable failure", async () => {
    expect(isRefusal(new Error("Unauthorized: No authorization header provided"))).toBe(true);
    expect(isRefusal(new Response("", { status: 500 }))).toBe(false);
    m.load.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(filled);
    renderPage();
    expect(await screen.findByText(C.failed)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: C.retry }));
    expect((await screen.findByTestId("total-cost")).textContent).toContain("$14.01");
  });

  it("fills totals, firms, surfaces and days, and opens a firm to show its people", async () => {
    m.load.mockResolvedValue(filled);
    renderPage();
    expect((await screen.findByTestId("total-calls")).textContent).toContain("1,234");
    expect((screen.getByTestId("total-cost")).textContent).toContain("$14.01");
    expect(screen.getByText("$0.0031")).toBeTruthy();
    expect(screen.getByText("$0.0114")).toBeTruthy();
    expect(screen.getByText("2026-11-17")).toBeTruthy();
    expect(screen.queryByText("Harper Quinn")).toBeNull();

    const toggle = screen.getByRole("button", { name: C.showPeople("Kestrel Bay") });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByText("Harper Quinn")).toBeTruthy();
    expect(screen.getByText(C.systemCalls)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: C.hidePeople("Kestrel Bay") }));
    expect(screen.queryByText("Harper Quinn")).toBeNull();
  });

  it("asks again for a new preset, and for a custom range only once it is valid", async () => {
    m.load.mockResolvedValue(filled);
    renderPage();
    await screen.findByTestId("total-cost");
    const picker = screen.getByRole("combobox", { name: C.range });
    fireEvent.change(picker, { target: { value: "30" } });
    await waitFor(() => expect(m.load).toHaveBeenLastCalledWith({ data: { days: 30 } }));

    fireEvent.change(picker, { target: { value: "custom" } });
    const show = screen.getByRole("button", { name: C.apply });
    expect((show as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(C.from), { target: { value: "2026-11-05" } });
    fireEvent.change(screen.getByLabelText(C.to), { target: { value: "2026-11-01" } });
    expect((screen.getByRole("alert")).textContent).toContain(C.badRange);
    expect((show as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(C.to), { target: { value: "2026-11-09" } });
    expect((show as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(show);
    await waitFor(() => expect(m.load).toHaveBeenLastCalledWith({ data: { from: "2026-11-05", to: "2026-11-09" } }));
  });
});
