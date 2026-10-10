// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "org-1", role: "admin", org_type: "company", clients_enabled: false } as Record<string, unknown>,
  row: { name: "Liam's workspace", industry: "Technology", size_band: "11-50", country: "US", use_for: "work", data_use_tier: "operate" },
  updates: [] as Array<Record<string, unknown>>,
  selects: [] as string[],
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: mocks.profile }),
  isBusinessOrg: (p: { org_type?: string } | null) => p?.org_type === "company" || p?.org_type === "partner",
}));
vi.mock("@/lib/telemetry-v2", () => ({ logV2: vi.fn() }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: () => ({
      select: (cols: string) => {
        mocks.selects.push(cols);
        return { eq: () => ({ maybeSingle: async () => ({ data: mocks.row, error: null }) }) };
      },
      update: (p: Record<string, unknown>) => {
        mocks.updates.push(p);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));

import { OrgDimensionsCard, NAME_REQUIRED_LINE } from "@/components/settings/OrgDimensionsCard";
import { ClientsSettingCard } from "@/components/settings/ClientsSettingCard";
import { WhatStaysPutSection } from "@/pages/AffiliationPage";

vi.setConfig({ testTimeout: 20000 });

afterEach(() => {
  cleanup();
  mocks.updates.length = 0;
  mocks.selects.length = 0;
});

async function renderCard(org_type: string) {
  mocks.profile = { ...mocks.profile, org_type };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OrgDimensionsCard />
    </QueryClientProvider>,
  );
  await screen.findByLabelText("Workspace name");
}

describe("WS-1 workspace settings", () => {
  it("seeds the name input from the org row", async () => {
    await renderCard("company");
    expect((screen.getByLabelText("Workspace name") as HTMLInputElement).value).toBe("Liam's workspace");
    expect(mocks.selects[0]).not.toContain("data_use_tier");
  });

  it("company saves name with its demographic fields, never data_use_tier", async () => {
    await renderCard("company");
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Acme Advisory" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toEqual({ name: "Acme Advisory", industry: "Technology", size_band: "11-50", country: "US" });
  });

  it("personal saves name with use_for and country", async () => {
    await renderCard("personal");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toEqual({ name: "Liam's workspace", use_for: "work", country: "US" });
    expect(mocks.updates[0]).not.toHaveProperty("data_use_tier");
  });

  it("an empty name blocks the save and shows the line", async () => {
    await renderCard("company");
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(NAME_REQUIRED_LINE)).toBeTruthy();
    expect(NAME_REQUIRED_LINE).toBe("A workspace needs a name.");
    expect(mocks.updates).toHaveLength(0);
  });

  it("has no Data use row", async () => {
    await renderCard("personal");
    expect(screen.queryByText("Data use")).toBeNull();
    expect(screen.queryByText("operate")).toBeNull();
  });

  it("the intro sentence sits with the demographic group, not above the name", async () => {
    await renderCard("company");
    const intro = screen.getByText(/All optional\. We use this to understand who Lasso is for/);
    expect(screen.getByTestId("workspace-about").contains(intro)).toBe(true);
    expect(screen.getByTestId("workspace-identity").contains(intro)).toBe(false);
    expect(screen.getByText("About this workspace, for our understanding only")).toBeTruthy();
    const name = screen.getByLabelText("Workspace name");
    expect(name.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["company", true],
    ["partner", true],
    ["personal", false],
    ["edu", false],
  ])("clients toggle for %s: %s", (org_type, shown) => {
    mocks.profile = { ...mocks.profile, org_type };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ClientsSettingCard />
      </QueryClientProvider>,
    );
    expect(Boolean(screen.queryByText("Use clients"))).toBe(shown);
  });

  it("names the sponsor when nothing is shared", () => {
    render(<WhatStaysPutSection institutionName="Ceiba·Uni" sharedCount={0} />);
    expect(screen.getByText("None of this reaches Ceiba·Uni.")).toBeTruthy();
    cleanup();
    render(<WhatStaysPutSection institutionName="Ceiba·Uni" sharedCount={2} />);
    expect(screen.getByText("Anything you have not placed on a shared board stays in your account.")).toBeTruthy();
  });
});
