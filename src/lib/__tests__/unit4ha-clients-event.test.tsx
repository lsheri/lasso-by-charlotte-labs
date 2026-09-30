import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsSettingCard } from "@/components/settings/ClientsSettingCard";
import { guardEventDims } from "@/lib/event-dim-allowlist";

const logEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry", () => ({ logEvent }));

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

const profile = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-profile", () => ({ useProfile: profile }));

function adminProfile() {
  return {
    id: "p1",
    org_id: "o1",
    role: "admin",
    org_type: "company",
    clients_enabled: true,
  };
}

function mount() {
  const client = new QueryClient();
  client.invalidateQueries = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <ClientsSettingCard />
    </QueryClientProvider>,
  );
  return client;
}

describe("unit 4h-a org.clients_changed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profile.mockReturnValue({ data: adminProfile() });
  });

  it("fires once with the new state when the save is accepted", async () => {
    rpc.mockResolvedValue({ data: { status: "ok" }, error: null });
    mount();
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => {
      expect(logEvent).toHaveBeenCalledTimes(1);
    });
    expect(logEvent).toHaveBeenCalledWith("org.clients_changed", "o1", { enabled: "false" });
  });

  it("fires nothing when the save is refused", async () => {
    rpc.mockResolvedValue({ data: { status: "refused", reason: "no" }, error: null });
    mount();
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledTimes(1);
    });
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("keeps only the enabled dim", () => {
    const result = guardEventDims("org.clients_changed", { enabled: "true", org_name: "Acme" });
    expect(result.keep).toBe(true);
    expect(result.dims).toEqual({ enabled: "true" });
  });
});
