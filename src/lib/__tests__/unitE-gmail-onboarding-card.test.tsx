// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connected: false,
  pickerKinds: [] as string[],
  initiateToolkits: [] as string[],
}));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: async () => {} }) }));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => async ({ data }: { data: { toolkit: string } }) => {
    mocks.initiateToolkits.push(data.toolkit);
    return { redirect_url: null };
  },
}));
vi.mock("@/lib/connectors.functions", () => ({ getConnectionStatus: {}, initiateConnection: {} }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/hooks/use-connector-accounts", () => ({
  TOOLKIT_LABELS: { gmail: "Gmail", googledrive: "Google Drive" },
  useConnectorAccounts: () => ({
    data: mocks.connected ? { gmail: { status: "connected" } } : {},
  }),
}));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/components/connectors/GranolaKeyCard", () => ({ GranolaKeyCard: () => null }));
vi.mock("@/components/connectors/ConnectorPicker", () => ({
  ConnectorPicker: ({ kind, trigger }: { kind: string; trigger: ReactNode }) => {
    mocks.pickerKinds.push(kind);
    return <div data-testid="picker">{trigger}</div>;
  },
}));
vi.mock("@/components/work/PasteThreadDialog", () => ({ PasteThreadDialog: () => null }));
vi.mock("@/components/work/UploadFilesButton", () => ({ UploadFilesButton: () => null }));
vi.mock("@/components/onboarding/McpSetupCard", () => ({ McpSetupCard: () => null }));
vi.mock("@/components/onboarding/ExportGuideCard", () => ({ ExportGuideCard: () => null }));

import { SetupTools } from "@/components/onboarding/SetupTools";

afterEach(() => {
  cleanup();
  mocks.pickerKinds = [];
  mocks.initiateToolkits = [];
  mocks.connected = false;
});

describe("Unit E: Gmail on the onboarding setup screen", () => {
  it("ticking only Gmail renders one Gmail card that connects to the Gmail toolkit", async () => {
    render(<SetupTools tools={["gmail"]} />);
    expect(screen.getByText("Connect once, then pick the threads you want.")).toBeTruthy();
    expect(screen.getByText("Or just bring one thing")).toBeTruthy();
    expect(screen.queryByText("Start anywhere")).toBeNull();
    const btn = screen.getByRole("button", { name: "Connect Gmail" });
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.initiateToolkits).toEqual(["gmail"]);
  });

  it("once connected, the picker is the Gmail picker, not Drive", () => {
    mocks.connected = true;
    render(<SetupTools tools={["gmail"]} />);
    expect(mocks.pickerKinds).toContain("gmail");
    expect(mocks.pickerKinds).not.toContain("googledrive");
    const trigger = screen.getByRole("button", { name: "Pick threads to bring in" });
    expect(trigger.getAttribute("data-picker-kind")).toBe("gmail");
    expect(trigger.getAttribute("data-toolkit")).toBe("gmail");
  });
});
