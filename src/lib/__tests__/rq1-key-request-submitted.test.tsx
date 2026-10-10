// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let profile: Record<string, unknown> | null = { org_type: "partner", role: "admin" };
vi.mock("@/hooks/use-profile", () => ({
  fetchProfile: async () => profile,
  useProfile: () => ({ data: { id: "p1", org_id: "o1", org_type: "partner", role: "admin" } }),
}));

let insertError: { message: string } | null = null;
const inserted: unknown[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      insert: async (row: unknown) => {
        inserted.push(row);
        return { error: insertError };
      },
    }),
  },
}));

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));

const { requirePartnerSubmitter, requirePartnerWorkspace } = await import("@/lib/partner-guard");
const { KeyRequestsPage, seatsBand } = await import("@/pages/KeyRequestsPage");
const { EVENT_DIM_KEYS } = await import("@/lib/event-dim-allowlist");

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);
beforeEach(() => {
  logEvent.mockReset();
  inserted.length = 0;
  insertError = null;
});

function submitForm(seats: string) {
  render(<QueryClientProvider client={new QueryClient()}><KeyRequestsPage /></QueryClientProvider>);
  fireEvent.change(document.getElementById("kr-client")!, { target: { value: "Acme Secret Client" } });
  fireEvent.click(screen.getByLabelText(/Individuals/));
  fireEvent.change(document.getElementById("kr-seats")!, { target: { value: seats } });
  fireEvent.submit(document.getElementById("kr-client")!.closest("form")!);
}

describe("RQ-1 guard", () => {
  it("lets only admin or lead of a partner workspace through", async () => {
    for (const role of ["admin", "lead"]) {
      profile = { org_type: "partner", role };
      await expect(requirePartnerSubmitter()).resolves.toBeUndefined();
    }
    for (const role of ["member", "coach"]) {
      profile = { org_type: "partner", role };
      await expect(requirePartnerSubmitter()).rejects.toBeTruthy();
    }
    profile = { org_type: "company", role: "admin" };
    await expect(requirePartnerSubmitter()).rejects.toBeTruthy();
  });

  it("leaves requirePartnerWorkspace open to a partner member", async () => {
    profile = { org_type: "partner", role: "member" };
    await expect(requirePartnerWorkspace()).resolves.toBeUndefined();
  });
});

describe("RQ-1 key_request.submitted", () => {
  it("bands seats into the closed set", () => {
    expect([1, 2, 5, 6, 20, 21, 400].map(seatsBand)).toEqual(["1", "2-5", "2-5", "6-20", "6-20", "21+", "21+"]);
  });

  it("is allowlisted with exactly the three dims", () => {
    expect(EVENT_DIM_KEYS["key_request.submitted"]).toEqual(["outcome", "seats_band", "workspace_kind"]);
  });

  it("fires outcome ok after a successful submit", async () => {
    submitForm("12");
    await waitFor(() => expect(logEvent).toHaveBeenCalledTimes(1));
    expect(inserted).toHaveLength(1);
    expect(logEvent).toHaveBeenCalledWith("key_request.submitted", "o1", {
      workspace_kind: "personal",
      seats_band: "6-20",
      outcome: "ok",
    });
  });

  it("fires outcome refused and shows the line when the insert is refused", async () => {
    insertError = { message: "new row violates row-level security policy" };
    submitForm("3");
    await waitFor(() => expect(logEvent).toHaveBeenCalledTimes(1));
    expect(logEvent).toHaveBeenCalledWith("key_request.submitted", "o1", {
      workspace_kind: "personal",
      seats_band: "2-5",
      outcome: "refused",
    });
    expect(await screen.findByText("That request did not go through. Please try again.")).toBeTruthy();
    const dims = JSON.stringify(logEvent.mock.calls[0]);
    expect(dims).not.toContain("Acme");
  });
});
