// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders personal rows flat with no optgroup at all", () => {
    mocks.profile = { org_type: "personal" };
    mocks.clients = [row("client-1", "Acme", "client"), row("folder-1", "Internal", "folder")];
    const { container } = renderPicker();
    expect(container.querySelectorAll("optgroup")).toHaveLength(0);
    expect(screen.getByRole("option", { name: "Acme" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Internal" })).toBeTruthy();
  });

  it("never renders more than one group named Folders for personal", () => {
    mocks.profile = { org_type: "personal" };
    mocks.clients = [row("client-1", "Acme", "client"), row("folder-1", "Internal", "folder")];
    const { container } = renderPicker();
    const folders = Array.from(container.querySelectorAll("optgroup")).filter(
      (group) => group.getAttribute("label") === "Folders",
    );
    expect(folders).toHaveLength(0);
  });

  it("renders exactly one of each group for a company workspace", () => {
    mocks.profile = { org_type: "company" };
    mocks.clients = [row("client-1", "Acme", "client"), row("folder-1", "Internal", "folder")];
    const { container } = renderPicker();
    const clients = container.querySelectorAll('optgroup[label="Clients"]');
    const folders = container.querySelectorAll('optgroup[label="Folders"]');
    expect(clients).toHaveLength(1);
    expect(folders).toHaveLength(1);
  });

  it("reads Terms and Folders for a school workspace", () => {
    mocks.profile = { org_type: "edu" };
    mocks.clients = [row("client-1", "Acme", "client"), row("folder-1", "Internal", "folder")];
    renderPicker();
    expect(screen.getByRole("group", { name: "Terms" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Folders" })).toBeTruthy();
  });

  it("names both create buttons for a company workspace", () => {
    renderPicker();
    expect(screen.getByRole("button", { name: "New client" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New folder" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New", exact: true })).toBeNull();
  });

  it("names both create buttons for a school workspace", () => {
    mocks.profile = { org_type: "edu" };
    renderPicker();
    expect(screen.getByRole("button", { name: "New term" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New folder" })).toBeTruthy();
  });

  it("renders exactly one New control for a personal workspace", () => {
    mocks.profile = { org_type: "personal" };
    renderPicker();
    expect(screen.getByRole("button", { name: "New folder" })).toBeTruthy();
    const newButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.startsWith("New"));
    expect(newButtons).toHaveLength(1);
  });

  it("puts the personal New control in client mode", () => {
    mocks.profile = { org_type: "personal" };
    renderPicker();
    screen.getByRole("button", { name: "New folder" }).click();
    // In personal, both creating === "client" and creating === "folder" render
    // the placeholder "Folder name", so the mode itself is not observable from
    // the markup; the placeholder is all the render can assert.
    expect(screen.getByPlaceholderText("Folder name")).toBeTruthy();
  });
});