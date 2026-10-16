// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WORKSPACE_KIND_COPY, WorkspaceKindCard } from "@/components/settings/WorkspaceKindCard";

const logEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ logEvent }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const profile = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-profile", () => ({ useProfile: profile }));

function base(over: Record<string, unknown> = {}) {
  return { id: "p1", org_id: "o1", role: "admin", org_type: "personal", tier: "individual", clients_enabled: false, ...over };
}

function mount() {
  const client = new QueryClient();
  client.invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceKindCard />
    </QueryClientProvider>,
  );
}

describe("C2 workspace kind card", () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it("lets an individual admin make the workspace a business one and logs the change", async () => {
    profile.mockReturnValue({ data: base() });
    rpc.mockResolvedValue({ data: { status: "ok", tier: "business" }, error: null });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Make this a business workspace" }));
    await waitFor(() => expect(logEvent).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("set_workspace_tier", { p_org: "o1", p_tier: "business" });
    expect(logEvent).toHaveBeenCalledWith("org.tier_changed", "o1", { from: "individual", to: "business" });
  });

  it("renders nothing for a partner workspace or a non-admin", () => {
    profile.mockReturnValue({ data: base({ org_type: "partner", tier: "business" }) });
    const partner = mount();
    expect(partner.container.innerHTML).toBe("");
    cleanup();
    profile.mockReturnValue({ data: base({ role: "em" }) });
    const member = mount();
    expect(member.container.innerHTML).toBe("");
  });

  it("keeps banned words and em dashes out of the copy", () => {
    for (const line of Object.values(WORKSPACE_KIND_COPY)) {
      expect(line).not.toMatch(/\b(tier|plan|unlock|upgrade)\b/i);
      expect(line).not.toContain("\u2014");
    }
  });
});
