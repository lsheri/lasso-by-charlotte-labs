// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const mocks = vi.hoisted(() => ({
  search: { authorization_id: "auth-1" } as Record<string, unknown>,
  navigate: vi.fn(),
  user: { id: "u1", email: "a@b.co" } as { id: string; email: string } | null,
  details: vi.fn(),
  approve: vi.fn(),
  deny: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  decide: vi.fn(),
  profileState: vi.fn(),
  activeId: null as string | null,
  assign: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts, useSearch: () => mocks.search }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn, createServerFn: vi.fn() }));
vi.mock("@/lib/mcp-connections.functions", () => ({
  CONNECTION_LIMIT_ERROR: "connection_limit",
  decideSignin: (...a: unknown[]) => mocks.decide(...a),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: mocks.user }, error: null }),
      signOut: mocks.signOut,
      oauth: {
        getAuthorizationDetails: (...a: unknown[]) => mocks.details(...a),
        approveAuthorization: (...a: unknown[]) => mocks.approve(...a),
        denyAuthorization: (...a: unknown[]) => mocks.deny(...a),
      },
    },
  },
}));
vi.mock("@/hooks/use-profile", () => ({
  fetchProfileState: () => mocks.profileState(),
  useActiveProfileId: () => mocks.activeId,
  ROLE_LABELS: { em: "Engagement manager" },
}));
vi.mock("@/components/layout/BrandLockup", () => ({ BrandLockup: () => null }));

import { Route } from "@/routes/oauth/consent";

type Opts = { component: (() => ReactNode) & { preload?: () => Promise<void> } };
const opts = (Route as unknown as { options: Opts }).options;
vi.setConfig({ testTimeout: 30000 });

const profile = (id: string, org: string) => ({ id, org_id: `o-${id}`, org_name: org, role: "em" });
const okDetails = (redirect = REDIRECT) => ({
  data: { authorization_id: "auth-1", redirect_uri: redirect, client: { id: "cid-1", name: "Claude" }, user: { id: "u1", email: "a@b.co" }, scope: "" },
  error: null,
});

beforeAll(async () => {
  await opts.component.preload?.();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign: mocks.assign } });
});
beforeEach(() => {
  mocks.search = { authorization_id: "auth-1" };
  mocks.user = { id: "u1", email: "a@b.co" };
  mocks.activeId = null;
  for (const m of [mocks.navigate, mocks.details, mocks.approve, mocks.deny, mocks.decide, mocks.profileState, mocks.assign]) m.mockReset();
  mocks.details.mockResolvedValue(okDetails());
  mocks.profileState.mockResolvedValue({ profiles: [profile("p1", "Acme")], hasDeactivated: false });
  mocks.decide.mockResolvedValue({ connection_id: "c1" });
  mocks.approve.mockResolvedValue({ data: { redirect_url: "https://claude.ai/back?code=1" }, error: null });
  mocks.deny.mockResolvedValue({ data: { redirect_url: "https://claude.ai/back?error=denied" }, error: null });
});
afterEach(() => cleanup());

function renderPage() {
  const C = opts.component;
  return render(<Suspense fallback={null}><C /></Suspense>);
}

describe("M3-C3b consent page", () => {
  it("(a) missing id", async () => {
    mocks.search = {};
    renderPage();
    expect(await screen.findByText("This link is incomplete")).toBeTruthy();
    expect(mocks.details).not.toHaveBeenCalled();
  });

  it("(b) signed out goes to /auth with next", async () => {
    mocks.user = null;
    renderPage();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth", search: { next: "/oauth/consent?authorization_id=auth-1" }, replace: true }),
    );
  });

  it("(c) details error is expired", async () => {
    mocks.details.mockResolvedValue({ data: null, error: new Error("x") });
    renderPage();
    expect(await screen.findByText("This request has expired")).toBeTruthy();
  });

  it("(d) an already approved answer returns straight away", async () => {
    mocks.details.mockResolvedValue({ data: { redirect_url: "https://claude.ai/again" }, error: null });
    renderPage();
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("https://claude.ai/again"));
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("(e) zero profiles shows set up, or no-access when deactivated", async () => {
    mocks.profileState.mockResolvedValue({ profiles: [], hasDeactivated: false });
    renderPage();
    expect(await screen.findByText("Set up Lasso first")).toBeTruthy();
    expect(screen.queryByText("Approve")).toBeNull();
    cleanup();
    mocks.profileState.mockResolvedValue({ profiles: [], hasDeactivated: true });
    renderPage();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/no-access", replace: true }));
  });

  it("(f) one profile approves in order and returns", async () => {
    renderPage();
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("https://claude.ai/back?code=1"));
    expect(mocks.decide).toHaveBeenCalledWith({
      data: { decision: "approve", profile_id: "p1", client_id: "cid-1", client_name: "Claude", redirect_uri: REDIRECT },
    });
    expect(mocks.approve).toHaveBeenCalledWith("auth-1", { skipBrowserRedirect: true });
    expect(mocks.decide.mock.invocationCallOrder[0]!).toBeLessThan(mocks.approve.mock.invocationCallOrder[0]!);
  });

  it("(g) two profiles default to the active one", async () => {
    mocks.activeId = "p2";
    mocks.profileState.mockResolvedValue({ profiles: [profile("p1", "Acme"), profile("p2", "Beta")], hasDeactivated: false });
    renderPage();
    const radios = (await screen.findAllByRole("radio")) as HTMLInputElement[];
    expect(radios.find((r) => r.value === "p2")!.checked).toBe(true);
    fireEvent.click(radios.find((r) => r.value === "p1")!);
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalled());
    expect((mocks.decide.mock.calls[0]![0] as { data: { profile_id: string } }).data.profile_id).toBe("p1");
  });

  it("(h) the connection limit shows the limit copy and never approves", async () => {
    mocks.decide.mockRejectedValue(new Error("connection_limit"));
    renderPage();
    fireEvent.click(await screen.findByText("Approve"));
    expect(
      await screen.findByText("You have 25 connections. Disconnect one in Settings, then choose Connect again in Claude."),
    ).toBeTruthy();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("(i) any other failure shows the generic copy and never approves", async () => {
    mocks.decide.mockRejectedValue(new Error("bind_failed"));
    renderPage();
    fireEvent.click(await screen.findByText("Approve"));
    expect(await screen.findByText("Something went wrong and nothing was connected. Try again.")).toBeTruthy();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("(j) deny records, denies, and returns", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Deny"));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("https://claude.ai/back?error=denied"));
    expect((mocks.decide.mock.calls[0]![0] as { data: { decision: string } }).data.decision).toBe("deny");
    expect(mocks.deny).toHaveBeenCalledWith("auth-1", { skipBrowserRedirect: true });
    expect(mocks.decide.mock.invocationCallOrder[0]!).toBeLessThan(mocks.deny.mock.invocationCallOrder[0]!);
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("(k) heading and host copy", async () => {
    renderPage();
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Connect Claude to Lasso");
    expect(screen.getByText("After you approve, you go back to claude.ai.")).toBeTruthy();
    cleanup();
    mocks.details.mockResolvedValue(okDetails("https://evil.com/cb"));
    const { container } = renderPage();
    expect(await screen.findByText("After you approve, you go back to evil.com.")).toBeTruthy();
    expect(container.textContent).not.toContain("—");
  });

  it("(l) the card is excluded from autocapture", async () => {
    renderPage();
    const card = await screen.findByTestId("consent-card");
    expect(card.className).toContain("ph-no-autocapture");
    expect(card.hasAttribute("data-ph-no-autocapture")).toBe(true);
  });
});
