// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const liveBoards = vi.fn();
const ledger = vi.fn();
const checks = vi.fn();
const shipped = vi.fn();

vi.mock("@/lib/firm-dashboard.functions", () => ({
  getFirmLiveBoards: (...args: unknown[]) => liveBoards(...args),
  getFirmCheckLibrary: (...args: unknown[]) => checks(...args),
  getFirmDashboard: vi.fn(),
  setFirmCheckActive: vi.fn(),
}));
vi.mock("@/lib/proposal-ledger.functions", () => ({ firmValueSoFar: (...args: unknown[]) => ledger(...args) }));
vi.mock("@/lib/shipped-work.functions", () => ({
  listShippedWork: () => shipped(),
  shipWork: vi.fn(),
  unshipWork: vi.fn(),
}));

const { useFirmViewWarmup } = await import("@/hooks/use-firm-view-warmup");
const { firmLiveBoardsQuery } = await import("@/components/firm/FirmLiveBoards");
const { firmProposalLedgerQuery } = await import("@/components/firm/FirmProposalsCard");
const { firmCheckLibraryQuery } = await import("@/hooks/use-firm-dashboard");

function Page({ profileId, cards }: { profileId: string | undefined; cards: boolean }) {
  useFirmViewWarmup(profileId);
  return cards ? <Cards profileId={profileId} /> : null;
}

function Cards({ profileId }: { profileId: string | undefined }) {
  useQuery(firmLiveBoardsQuery(profileId));
  useQuery(firmProposalLedgerQuery(profileId));
  useQuery(firmCheckLibraryQuery(profileId));
  return null;
}

let client: QueryClient;
function mount(profileId: string | undefined, cards = false) {
  return render(
    <QueryClientProvider client={client}>
      <Page profileId={profileId} cards={cards} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  liveBoards.mockReset().mockResolvedValue([]);
  ledger.mockReset().mockResolvedValue({ figures: [] });
  checks.mockReset().mockResolvedValue([]);
  shipped.mockReset().mockResolvedValue([]);
});

afterEach(cleanup);

describe("PERF-4: the Firm view starts its card reads at once", () => {
  it("asks for the boards, the proposals ledger, the checks and the shipped work as soon as an admin opens it", async () => {
    mount("admin-1");
    await waitFor(() => expect(shipped).toHaveBeenCalledTimes(1));
    expect(liveBoards).toHaveBeenCalledWith({ data: { profile_id: "admin-1" } });
    expect(ledger).toHaveBeenCalledWith({ data: { profile_id: "admin-1" } });
    expect(checks).toHaveBeenCalledWith({ data: { profile_id: "admin-1" } });
  });

  it("reads nothing for someone who may not see the page", async () => {
    mount(undefined);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(liveBoards).not.toHaveBeenCalled();
    expect(ledger).not.toHaveBeenCalled();
    expect(checks).not.toHaveBeenCalled();
    expect(shipped).not.toHaveBeenCalled();
  });

  it("lets the cards use what it read instead of asking again", async () => {
    const { rerender } = mount("admin-1");
    await waitFor(() => expect(checks).toHaveBeenCalledTimes(1));
    rerender(
      <QueryClientProvider client={client}>
        <Page profileId="admin-1" cards />
      </QueryClientProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(liveBoards).toHaveBeenCalledTimes(1);
    expect(ledger).toHaveBeenCalledTimes(1);
    expect(checks).toHaveBeenCalledTimes(1);
  });

  it("keeps the ledger's no-retry rule, so a refused ledger read is asked once", async () => {
    ledger.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    mount("admin-1");
    await waitFor(() => expect(ledger).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ledger).toHaveBeenCalledTimes(1);
  });
});
