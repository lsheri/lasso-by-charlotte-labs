// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientRow } from "@/hooks/use-clients";
import { CONTAINER_ACTIONS_COPY as COPY } from "@/lib/container-actions";
import { CONTAINER_COLOURS } from "@/lib/container-colour";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), rpc: vi.fn(), logEvent: vi.fn(), error: vi.fn(),
  rows: [] as ClientRow[],
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { org_id: "o1", org_type: "company", role: "admin", clients_enabled: true } }),
}));
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: mocks.rows }),
  useInvalidateClients: () => vi.fn(),
  createClient: mocks.createClient, renameClient: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));

import { SidebarCreateActions } from "@/components/engagements/SidebarCreateActions";
import { ClientPicker } from "@/components/engagements/ClientPicker";
import { depthFor } from "@/components/engagements/create-container";

function rows(live: number, archived: number): ClientRow[] {
  return Array.from({ length: live + archived }, (_, i) => ({
    id: `c${i}`, name: `Container ${i}`, code: null, quick_folder: false,
    kind: "folder", parent_id: null, archived_at: i < live ? null : "2026-01-01",
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = rows(5, 0);
  mocks.createClient.mockResolvedValue("new-id");
  mocks.rpc.mockResolvedValue({ data: { status: "colored" }, error: null });
});
afterEach(cleanup);

it("keeps top-level depth 1 before and after supplying real rows", () => {
  expect(depthFor(null, [])).toBe(1);
  expect(depthFor(null, rows(5, 4))).toBe(1);
});

describe.each(["sidebar", "picker"] as const)("CC2 %s creation", (surface) => {
  function open() {
    if (surface === "sidebar") render(<SidebarCreateActions empty={false} />);
    else render(<ClientPicker orgId="o1" value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Container colours" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "New work" } });
  }

  it("defaults to None and creates without a colour call or event", async () => {
    open();
    const strip = screen.getByRole("group", { name: "Container colours" });
    expect(within(strip).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
      .toEqual([COPY.noColour, ...CONTAINER_COLOURS]);
    expect(within(strip).getByRole("button", { name: COPY.noColour }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(mocks.logEvent).toHaveBeenCalledWith("container.created", "o1", {
      kind: "folder", from: surface === "sidebar" ? "sidebar" : "picker", depth: "1",
    }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.logEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createClient).toHaveBeenCalledWith({ orgId: "o1", name: "New work", kind: "folder", parentId: null });
  });

  it("saves colour once and includes the sixth live container in the band", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "blue" }));
    expect(screen.getByRole("button", { name: "blue" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(screen.getByRole("button", { name: "blue" }), { key: "Enter" });
    await waitFor(() => expect(mocks.logEvent).toHaveBeenCalledWith("container.colored", "o1", {
      kind: "folder", color: "blue", from: "create", at_create: true, containers_band: "6-15",
    }));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("set_container_color", { p_id: "new-id", p_color: "blue" });
    expect(mocks.logEvent).toHaveBeenCalledWith("container.created", "o1", {
      kind: "folder", from: surface === "sidebar" ? "sidebar" : "picker", depth: "1",
    });
  });

  it("excludes archived containers from the creation band", async () => {
    mocks.rows = rows(1, 5);
    open();
    fireEvent.click(screen.getByRole("button", { name: "green" }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(mocks.logEvent).toHaveBeenCalledWith("container.colored", "o1", {
      kind: "folder", color: "green", from: "create", at_create: true, containers_band: "2-5",
    }));
  });

  it("cancels from a swatch with Escape and resets to None on reopening", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "rose" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "rose" }), { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Container colours" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    expect(screen.getByRole("button", { name: COPY.noColour }).getAttribute("aria-pressed")).toBe("true");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("keeps the created container on a refused colour and emits no colour event", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "refused", reason: "Colour refused." }, error: null });
    open();
    fireEvent.click(screen.getByRole("button", { name: "blue" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Colour refused."));
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.logEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logEvent).toHaveBeenCalledWith("container.created", "o1", {
      kind: "folder", from: surface === "sidebar" ? "sidebar" : "picker", depth: "1",
    });
    await waitFor(() => expect(screen.queryByRole("group", { name: "Container colours" })).toBeNull());
  });
});