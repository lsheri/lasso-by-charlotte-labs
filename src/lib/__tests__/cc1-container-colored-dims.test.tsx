// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { containersBand } from "@/lib/container-colour";
import { guardEventDims } from "@/lib/event-dim-allowlist";

const mocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
  rpc: vi.fn(),
  clientRows: [
    { id: "c1", name: "ABC Co", kind: "client", parent_id: null, quick_folder: false, archived_at: null },
    { id: "f1", name: "Folder One", kind: "folder", parent_id: "c1", quick_folder: false, archived_at: null },
    { id: "a1", name: "Old A", kind: "folder", parent_id: null, quick_folder: false, archived_at: "2026-01-01" },
    { id: "a2", name: "Old B", kind: "folder", parent_id: null, quick_folder: false, archived_at: "2026-01-01" },
    { id: "a3", name: "Old C", kind: "folder", parent_id: null, quick_folder: false, archived_at: "2026-01-01" },
    { id: "a4", name: "Old D", kind: "folder", parent_id: null, quick_folder: false, archived_at: "2026-01-01" },
  ],
}));

vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => mocks.rpc(...args) },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", org_type: "partner", role: "worker", clients_enabled: true } }),
}));
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: mocks.clientRows }),
  useInvalidateClients: () => () => {},
  renameClient: vi.fn(),
  reparentClient: vi.fn(),
  deleteContainer: vi.fn(),
  moveWorkboard: vi.fn(),
}));

import { SidebarItemMenu } from "@/components/layout/SidebarItemMenu";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <SidebarItemMenu
      target={{ type: "container", id: "f1", name: "Folder One", kind: "folder", workboards: 0, folders: 0 }}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

afterEach(() => {
  cleanup();
  mocks.logEvent.mockReset();
});

describe("CC1 container.colored dims", () => {
  it("pins the band ladder at its boundaries", () => {
    const cases: [number, string][] = [
      [0, "1"], [1, "1"], [2, "2-5"], [5, "2-5"], [6, "6-15"], [15, "6-15"], [16, "16+"], [17, "16+"],
    ];
    for (const [n, band] of cases) expect(containersBand(n)).toBe(band);
  });

  it("fires from the colour picker with both dims, archived containers not counted", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "colored" }, error: null });
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "More actions for Folder One" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Colour" }));
    fireEvent.click(await screen.findByRole("button", { name: "blue" }));

    // Six rows, four archived: two live is "2-5"; counting archived would give "6-15".
    await waitFor(() =>
      expect(mocks.logEvent).toHaveBeenCalledWith("container.colored", "o1", {
        kind: "folder",
        color: "blue",
        from: "menu",
        at_create: false,
        containers_band: "2-5",
      }),
    );
  });

  it("admits both new keys and drops an unlisted one", () => {
    const result = guardEventDims("container.colored", {
      kind: "folder",
      color: "blue",
      from: "menu",
      at_create: false,
      containers_band: "2-5",
      name: "Acme",
    });
    expect(result.dims).toEqual({
      kind: "folder",
      color: "blue",
      from: "menu",
      at_create: false,
      containers_band: "2-5",
    });
  });
});
