// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientPicker } from "@/components/engagements/ClientPicker";
import { SidebarCreateActions } from "@/components/engagements/SidebarCreateActions";
import { canManageMembers } from "@/lib/role-access";

const mocks = vi.hoisted(() => ({
  profile: { org_type: "company", role: "admin", org_id: "org-1", clients_enabled: true } as {
    org_type: "company" | "personal" | "edu";
    role: string;
    org_id: string;
    clients_enabled?: boolean;
  },
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: mocks.profile, profiles: [mocks.profile] }),
}));

vi.mock("@/hooks/use-clients", () => ({
  createClient: vi.fn(),
  renameClient: vi.fn(),
  useClients: () => ({ data: [] }),
  useInvalidateClients: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
  mocks.profile = { org_type: "company", role: "admin", org_id: "org-1", clients_enabled: true };
});

function renderBoth() {
  return render(
    <>
      <SidebarCreateActions empty={false} />
      <ClientPicker orgId="org-1" value={null} onChange={vi.fn()} />
    </>,
  );
}

describe("unit 4c client minting gate", () => {
  it("shows New client to a lead and keeps New folder, in both places", () => {
    mocks.profile = { org_type: "company", role: "lead", org_id: "org-1", clients_enabled: true };
    renderBoth();
    expect(screen.getAllByRole("button", { name: "New client" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "New folder" })).toHaveLength(2);
  });

  it("shows New client to an admin", () => {
    renderBoth();
    expect(screen.getAllByRole("button", { name: "New client" })).toHaveLength(2);
  });

  it("hides New client from an em but keeps New folder in both places", () => {
    mocks.profile = { org_type: "company", role: "em", org_id: "org-1", clients_enabled: true };
    renderBoth();
    expect(screen.queryByRole("button", { name: "New client" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "New folder" })).toHaveLength(2);
    // The picker stays usable: existing clients and the empty option remain.
    expect(screen.getByRole("option", { name: "No client" })).toBeTruthy();
  });

  it("decides through canManageMembers and nothing else", () => {
    // The gate is exactly the shared predicate: whatever it allows, the UI shows.
    for (const role of ["admin", "lead", "em", "coach", "worker"]) {
      mocks.profile = { org_type: "company", role, org_id: "org-1", clients_enabled: true };
      const { unmount } = render(<SidebarCreateActions empty={false} />);
      const shown = screen.queryByRole("button", { name: "New client" }) !== null;
      expect(shown).toBe(canManageMembers(mocks.profile));
      unmount();
    }
  });

  it("shows New client only when clients are on AND the person can manage members", () => {
    const cases: [boolean, string, boolean][] = [
      [true, "admin", true],
      [true, "em", false],
      [false, "admin", false],
      [false, "em", false],
    ];
    for (const [enabled, role, expected] of cases) {
      mocks.profile = { org_type: "company", role, org_id: "org-1", clients_enabled: enabled };
      const { unmount } = render(<SidebarCreateActions empty={false} />);
      expect(screen.queryByRole("button", { name: "New client" }) !== null).toBe(expected);
      unmount();
    }
  });
});
