// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WORKSPACE_KIND_COPY, WorkspaceKindCard } from "@/components/settings/WorkspaceKindCard";
import { guardEventDims } from "@/lib/event-dim-allowlist";

const logEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ logEvent }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const profile = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-profile", () => ({ useProfile: profile }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function mount() {
  const client = new QueryClient();
  client.invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceKindCard />
    </QueryClientProvider>,
  );
}

const named = (name: string) => logEvent.mock.calls.filter((c) => c[0] === name);

describe("N2 workspace kind confirm", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
    profile.mockReturnValue({ data: { id: "p1", org_id: "o1", role: "admin", org_type: "personal", tier: "individual", clients_enabled: false } });
    rpc.mockResolvedValue({ data: { status: "ok", tier: "business" }, error: null });
  });

  it("opens the dialog without changing anything", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: WORKSPACE_KIND_COPY.toBusiness }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(WORKSPACE_KIND_COPY.confirmToBusinessTitle)).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cancel closes it with no change and no tier_changed", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: WORKSPACE_KIND_COPY.toBusiness }));
    fireEvent.click(screen.getByRole("button", { name: WORKSPACE_KIND_COPY.confirmCancel }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(rpc).not.toHaveBeenCalled();
    expect(named("org.tier_changed")).toHaveLength(0);
  });

  it("confirm changes once, logs tier_changed once and says so", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: WORKSPACE_KIND_COPY.toBusiness }));
    fireEvent.click(screen.getByRole("button", { name: WORKSPACE_KIND_COPY.confirmToBusinessAction }));
    await waitFor(() => expect(named("org.tier_changed")).toHaveLength(1));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("set_workspace_tier", { p_org: "o1", p_tier: "business" });
    expect(named("org.tier_changed")[0]).toEqual(["org.tier_changed", "o1", { from: "individual", to: "business" }]);
    expect(toast.success).toHaveBeenCalledWith(WORKSPACE_KIND_COPY.doneBusiness);
  });

  it("tier_change_opened fires on open, exactly once, and not again on confirm", async () => {
    mount();
    expect(named("org.tier_change_opened")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: WORKSPACE_KIND_COPY.toBusiness }));
    // Checked before any confirm: red if the emit moves to the confirm handler.
    expect(named("org.tier_change_opened")).toEqual([["org.tier_change_opened", "o1", { from: "individual", to: "business" }]]);
    expect(rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: WORKSPACE_KIND_COPY.confirmToBusinessAction }));
    await waitFor(() => expect(named("org.tier_changed")).toHaveLength(1));
    expect(named("org.tier_change_opened")).toHaveLength(1);
  });

  it("business description makes no archive claim", () => {
    expect(WORKSPACE_KIND_COPY.businessDescription).not.toMatch(/archive/i);
  });

  it("allowlist admits from and to and drops anything else", () => {
    const result = guardEventDims("org.tier_change_opened", { from: "individual", to: "business", extra: "x" });
    expect(result.dims).toEqual({ from: "individual", to: "business" });
  });
});
