// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientPicker } from "@/components/engagements/ClientPicker";

const mocks = vi.hoisted(() => ({
  profile: { org_type: "company" } as { org_type: "company" | "personal" | "edu" },
  clients: [] as Array<{
    id: string;
    name: string;
    code: string | null;
    quick_folder: boolean;
    kind: "client" | "folder";
  }>,
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: mocks.profile, profiles: [mocks.profile] }),
}));

vi.mock("@/hooks/use-clients", () => ({
  createClient: vi.fn(),
  renameClient: vi.fn(),
  useClients: () => ({ data: mocks.clients }),
  useInvalidateClients: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
  mocks.clients = [];
});

function row(id: string, name: string, kind: "client" | "folder") {
  return { id, name, code: null, quick_folder: false, kind };
}

function renderPicker() {
  return render(<ClientPicker orgId="org-1" value={null} onChange={vi.fn()} />);
}

describe("pass 207 folder kind", () => {
  it("groups client and folder rows separately", () => {
    mocks.clients = [row("client-1", "Acme", "client"), row("folder-1", "Internal", "folder")];
    renderPicker();
    expect(screen.getByRole("group", { name: "Clients" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Folders" })).toBeTruthy();
  });

  it("omits the folder group when there are only clients", () => {
    mocks.clients = [row("client-1", "Acme", "client")];
    renderPicker();
    expect(screen.getByRole("group", { name: "Clients" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Folders" })).toBeNull();
  });

  it("shows neither group when empty and keeps the empty option", () => {
    renderPicker();
    expect(screen.queryByRole("group", { name: "Clients" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Folders" })).toBeNull();
    expect(screen.getByRole("option", { name: "No client" })).toBeTruthy();
  });

  it("offers a new folder control", () => {
    renderPicker();
    expect(screen.getByRole("button", { name: "New folder" })).toBeTruthy();
  });

  it("keeps company strings exact", () => {
    renderPicker();
    expect(screen.getByText("Client (optional)")).toBeTruthy();
    expect(screen.getByRole("option", { name: "No client" })).toBeTruthy();
  });
});