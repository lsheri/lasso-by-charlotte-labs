// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const rpc = vi.fn();
const logEvent = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const invalidate = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) } }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "org1", role: "em", orgs: { clients_enabled: true } } }),
}));
const ago = new Date(Date.now() - 3 * 86_400_000).toISOString();
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({
    isLoading: false,
    data: [
      { id: "c-arch", name: "Acme Archived", kind: "client", parent_id: null, archived_at: ago },
      { id: "f-arch", name: "Old Folder", kind: "folder", parent_id: null, archived_at: ago },
      { id: "c-live", name: "Live Client", kind: "client", parent_id: null, archived_at: null },
    ],
  }),
  useInvalidateClients: () => invalidate,
}));
vi.mock("@/hooks/use-engagements", () => ({
  useArchivedEngagements: () => ({
    isLoading: false,
    data: [{ id: "e-arch", title: "Shelved Board", archived_at: ago }],
  }),
}));

import { ArchivedSection } from "@/components/archive/ArchivedSection";

beforeEach(() => {
  rpc.mockReset();
  logEvent.mockReset();
  toastError.mockReset();
  invalidate.mockReset();
});
afterEach(cleanup);

const unarchivedCalls = () => logEvent.mock.calls.filter((c) => c[0] === "container.unarchived");

describe("SB-C1b-1 Archived section", () => {
  it("renders archived client, folder and workboard, and not a live container", () => {
    render(<ArchivedSection />);
    expect(screen.getByText("Acme Archived")).toBeTruthy();
    expect(screen.getByText("Old Folder")).toBeTruthy();
    expect(screen.getByText("Shelved Board")).toBeTruthy();
    expect(screen.queryByText("Live Client")).toBeNull();
    expect(screen.getAllByTestId("archived-row")).toHaveLength(3);
  });

  it("Bring back calls unarchive_container with the row id and logs a bucketed event", async () => {
    rpc.mockResolvedValue({ data: { status: "unarchived" }, error: null });
    render(<ArchivedSection />);
    const row = screen.getByText("Old Folder").closest("li") as HTMLElement;
    fireEvent.click(row.querySelector("button") as HTMLButtonElement);
    await waitFor(() => expect(unarchivedCalls()).toHaveLength(1));
    expect(rpc).toHaveBeenCalledWith("unarchive_container", { p_id: "f-arch" });
    expect(unarchivedCalls()[0]).toEqual(["container.unarchived", "org1", { kind: "folder", days_archived: "1-10" }]);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("a refusal shows the database sentence and fires no unarchived event", async () => {
    rpc.mockResolvedValue({ data: { status: "forbidden", reason: "Only a lead can bring that back." }, error: null });
    render(<ArchivedSection />);
    const row = screen.getByText("Shelved Board").closest("li") as HTMLElement;
    fireEvent.click(row.querySelector("button") as HTMLButtonElement);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Only a lead can bring that back."));
    expect(rpc).toHaveBeenCalledWith("unarchive_container", { p_id: "e-arch" });
    expect(unarchivedCalls()).toHaveLength(0);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("fires container.archive_opened once across re-renders", () => {
    const { rerender } = render(<ArchivedSection />);
    rerender(<ArchivedSection />);
    rerender(<ArchivedSection />);
    const opened = logEvent.mock.calls.filter((c) => c[0] === "container.archive_opened");
    expect(opened).toEqual([["container.archive_opened", "org1", { from: "past_work" }]]);
  });
});
