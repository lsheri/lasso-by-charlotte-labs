// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientPicker } from "@/components/engagements/ClientPicker";
import { DEFAULT_VOCAB } from "@/lib/edu-vocab";

const mocks = vi.hoisted(() => ({
  profile: { org_type: "company" } as { org_type: "company" | "personal" | "edu" },
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

afterEach(() => cleanup());

function renderPicker() {
  return render(<ClientPicker orgId="org-1" value={null} onChange={vi.fn()} />);
}

describe("pass 203 client picker vocabulary", () => {
  it("keeps the company picker byte identical", () => {
    mocks.profile = { org_type: "company", role: "admin" };
    renderPicker();
    expect(screen.getByText("Client (optional)")).toBeTruthy();
    expect(screen.getByRole("option", { name: "No client" })).toBeTruthy();
  });

  it("uses personal workspace words", () => {
    mocks.profile = { org_type: "personal", role: "admin" };
    renderPicker();
    expect(screen.getByText("Folder (optional)")).toBeTruthy();
    expect(screen.getByRole("option", { name: "No folder" })).toBeTruthy();
  });

  it("uses school workspace words", () => {
    mocks.profile = { org_type: "edu", role: "admin" };
    renderPicker();
    expect(screen.getByText("Term (optional)")).toBeTruthy();
    expect(screen.getByRole("option", { name: "No term" })).toBeTruthy();
  });

  it("keeps all five company strings byte identical", () => {
    const composed = [
      `${DEFAULT_VOCAB.client} (optional)`,
      `No ${DEFAULT_VOCAB.client.toLowerCase()}`,
      `${DEFAULT_VOCAB.client} name`,
      `New ${DEFAULT_VOCAB.client.toLowerCase()} name`,
      `${DEFAULT_VOCAB.client} renamed.`,
    ];

    expect(composed).toEqual([
      "Client (optional)",
      "No client",
      "Client name",
      "New client name",
      "Client renamed.",
    ]);
  });
});