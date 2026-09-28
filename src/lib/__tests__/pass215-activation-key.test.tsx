// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  profile: null as null | { id: string; org_id: string; role: string; org_type: string },
  institution: null as null | { id: string; name: string; slug: string },
  redeem: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: mocks.profile }) }));
vi.mock("@/hooks/use-affiliation", () => ({
  useAffiliation: () => ({ data: { institution: mocks.institution } }),
}));
vi.mock("@/lib/activation-keys.functions", () => ({ redeemActivationKeyFn: mocks.redeem }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { ActivationKeyCard } from "@/components/settings/ActivationKeyCard";

const BANNED = ["score", "monitor", "track", "surveillance", "compliance", "fluency", "gaps", "caught"];

function renderCard() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ActivationKeyCard />
    </QueryClientProvider>
  );
}

const admin = { id: "p-6", org_id: "o-6", role: "admin", org_type: "personal" };

beforeEach(() => {
  mocks.profile = admin;
  mocks.institution = null;
  mocks.redeem.mockReset();
  mocks.logEvent.mockReset();
});
afterEach(cleanup);

describe("pass215 activation key card", () => {
  it("renders nothing for a non-admin", () => {
    mocks.profile = { ...admin, role: "member" };
    const { container } = renderCard();
    expect(container.innerHTML).toBe("");
  });

  it("an affiliated admin sees the institution and no input", () => {
    mocks.institution = { id: "i", name: "Ceiba", slug: "ceiba" };
    renderCard();
    expect(screen.getByText(/linked to Ceiba/)).toBeTruthy();
    expect(screen.getByText("What Ceiba sees")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("an unaffiliated admin sees the input and the button", () => {
    renderCard();
    expect(screen.getByLabelText("Key")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Link workspace" })).toBeTruthy();
  });

  it("submits the code with profile_id", async () => {
    mocks.redeem.mockResolvedValue({ ok: false, reason: "not_found", message: "x" });
    renderCard();
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "abcd1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Link workspace" }));
    await waitFor(() => expect(mocks.redeem).toHaveBeenCalled());
    const arg = mocks.redeem.mock.calls[0]![0] as { data: { code: string; profile_id: string } };
    expect(arg.data.profile_id).toBe("p-6");
    expect(normal(arg.data.code)).toBe("ABCD1234");
  });

  it("a refusal shows the message and records its reason", async () => {
    mocks.redeem.mockResolvedValue({ ok: false, reason: "expired", message: "That key has expired." });
    renderCard();
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "KEY9" } });
    fireEvent.click(screen.getByRole("button", { name: "Link workspace" }));
    await screen.findByText("That key has expired.");
    expect(mocks.logEvent).toHaveBeenCalledWith("activation_key.submitted", "o-6", {
      reason: "expired",
      from: "settings",
    });
  });

  it("a success shows the confirmation and records redeemed", async () => {
    mocks.redeem.mockResolvedValue({
      ok: true,
      reason: "redeemed",
      message: "Key accepted. Your workspace is now linked.",
      institution_name: "Ceiba",
    });
    renderCard();
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "KEY9" } });
    fireEvent.click(screen.getByRole("button", { name: "Link workspace" }));
    await screen.findByText(/Key accepted/);
    expect(screen.getByText(/Linked to Ceiba/)).toBeTruthy();
    expect(mocks.logEvent).toHaveBeenCalledWith("activation_key.submitted", "o-6", {
      reason: "redeemed",
      from: "settings",
    });
    expect(JSON.stringify(mocks.logEvent.mock.calls)).not.toContain("KEY9");
  });

  it("no rendered string uses a banned word", () => {
    const { container, unmount } = renderCard();
    let text = container.textContent ?? "";
    unmount();
    mocks.institution = { id: "i", name: "Ceiba", slug: "ceiba" };
    text += renderCard().container.textContent ?? "";
    for (const w of BANNED) expect(text.toLowerCase()).not.toContain(w);
  });
});

function normal(s: string) {
  return s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
