// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  lookup: vi.fn(),
  redeem: vi.fn(),
  getUser: vi.fn(),
  signIn: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ data: { user: { id: "new-user", identities: [{}] }, session: null }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  resend: vi.fn(async () => ({ error: null })),
  logEvent: vi.fn(),
  navigate: vi.fn(),
  profile: null as null | { id: string; org_id?: string; org_name?: string },
  authEntryUser: null as null | { id: string; email?: string },
  inviteCheck: undefined as undefined | { ok: true; email: string | null; org_name: string | null },
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    options: opts,
    useSearch: () => mocks.search,
  }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  redirect: (x: unknown) => x,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {}, removeQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "auth-entry-user") return { data: mocks.authEntryUser };
    if (queryKey[0] === "auth-entry-profile") return { data: mocks.profile };
    if (queryKey[0] === "signup-invite") return { data: mocks.inviteCheck };
    if (queryKey[0] === "auth-entry-key") return { data: { ok: true, institution_name: "Harbor College" } };
    return { data: undefined };
  },
}));
vi.mock("@tanstack/react-start", async (orig) => ({
  ...(await orig<object>()),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      getSession: async () => ({ data: { session: null } }),
      signUp: mocks.signUp,
      signInWithPassword: mocks.signIn,
      signOut: mocks.signOut,
      resend: mocks.resend,
    },
    rpc: async () => ({ data: "p1", error: null }),
    from: () => {
      const chain: Record<string, unknown> = {};
      const done = Promise.resolve({ data: [], error: null });
      for (const k of ["select", "eq", "is", "update", "insert"]) chain[k] = () => chain;
      chain["maybeSingle"] = async () => ({ data: { org_id: "o1", settings: {} }, error: null });
      chain["then"] = done.then.bind(done);
      return chain;
    },
  },
}));
vi.mock("@/lib/activation-keys.functions", () => ({
  lookupActivationKeyFn: mocks.lookup,
  redeemActivationKeyFn: mocks.redeem,
}));
vi.mock("@/lib/invites.functions", () => ({ checkSignupInvite: vi.fn(async () => mocks.inviteCheck) }));
vi.mock("@/lib/client-telemetry", () => ({ aliasSignupVisitor: vi.fn(), emitClientEvent: vi.fn() }));
vi.mock("@/lib/posthog-client", () => ({ identifyPostHog: vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => mocks.profile, AUTH_USER_KEY: ["auth-user"] }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/layout/EntryDoorLink", () => ({ EntryDoorLink: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({
  EnterInviteCode: () => null,
  parseInvite: (raw: string) => {
    const value = raw.trim();
    return /^[a-zA-Z0-9-]{4,}$/.test(value) ? { code: value } : null;
  },
}));

import { KEY_STORAGE, markActivationKey, readActivationKey } from "@/lib/key-entry";
import { Route as JRoute } from "@/routes/j.$code";
import { Route as AuthRoute } from "@/routes/auth";
import { KEY_KEPT_COPY, Route as OnbRoute } from "@/routes/onboarding";
import { CODE_ENTRY_ERROR, PlansPage } from "@/routes/plans";

type Opts = {
  component: (() => ReactNode) & { preload?: () => Promise<unknown> };
  beforeLoad: (a: unknown) => Promise<unknown> | unknown;
};
const jOpts = (JRoute as unknown as { options: Opts }).options;
const authOpts = (AuthRoute as unknown as { options: Opts }).options;
const onbOpts = (OnbRoute as unknown as { options: Opts }).options;

vi.setConfig({ testTimeout: 30000 });
beforeAll(async () => {
  await authOpts.component.preload?.();
  await onbOpts.component.preload?.();
}, 30000);
beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mocks.profile = null;
  mocks.authEntryUser = null;
  mocks.inviteCheck = undefined;
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
});
afterEach(cleanup);

async function caught(fn: () => unknown) {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected a redirect");
}

describe("Unit 19: partner invite path", () => {
  it("a. /j/$code with a personal key carries intent personal and the key", async () => {
    mocks.lookup.mockResolvedValue({ ok: true, institution_name: "UW", register: "personal" });
    const r = await caught(() => jOpts.beforeLoad({ params: { code: "LSO-WPSK77" }, location: { searchStr: "" } }));
    expect(r).toEqual({ to: "/auth", search: { intent: "personal", key: "LSO-WPSK77" } });
  });

  it("b. /j/$code with a failing lookup redirects exactly as before", async () => {
    mocks.lookup.mockRejectedValue(new Error("Unauthorized"));
    const r = await caught(() =>
      jOpts.beforeLoad({ params: { code: "LSO-WPSK77" }, location: { searchStr: "?from=ceiba" } }),
    );
    expect(r).toEqual({ to: "/auth", search: { key: "LSO-WPSK77", from: "ceiba" } });
  });

  it("c. /onboarding with no session goes to /auth carrying intent and key", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const r = await caught(() => onbOpts.beforeLoad({ search: { intent: "personal", key: "LSO-WPSK77" } }));
    expect(r).toEqual({ to: "/auth", search: { intent: "personal", key: "LSO-WPSK77" } });
  });

  it("f. /j/CODE?r=personal uses the link register and never calls the lookup", async () => {
    const r = await caught(() =>
      jOpts.beforeLoad({ params: { code: "LSO-WPSK77" }, location: { searchStr: "?r=personal" } }),
    );
    expect(r).toEqual({ to: "/auth", search: { intent: "personal", key: "LSO-WPSK77" } });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("g. /j/CODE?r=bogus ignores the parameter and falls back to the lookup", async () => {
    mocks.lookup.mockResolvedValue({ ok: true, institution_name: "UW", register: "edu" });
    const r = await caught(() =>
      jOpts.beforeLoad({ params: { code: "LSO-WPSK77" }, location: { searchStr: "?r=bogus" } }),
    );
    expect(mocks.lookup).toHaveBeenCalled();
    expect(r).toEqual({ to: "/auth", search: { intent: "edu", key: "LSO-WPSK77" } });
  });

  it("h. /j/CODE?r=personal&from=ceiba keeps from alongside intent and key", async () => {
    const r = await caught(() =>
      jOpts.beforeLoad({ params: { code: "LSO-WPSK77" }, location: { searchStr: "?r=personal&from=ceiba" } }),
    );
    expect(r).toEqual({ to: "/auth", search: { intent: "personal", key: "LSO-WPSK77", from: "ceiba" } });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  async function signIn() {
    render(
      <Suspense fallback={null}>
        <authOpts.component />
      </Suspense>,
    );
    await waitFor(() => expect(document.querySelector("form")).toBeTruthy(), { timeout: 25000 });
    fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: "a@b.com" } });
    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "secret12" } });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalled());
  }

  it("d. signing in keeps a key in the URL and clears a stored-only key", async () => {
    mocks.search = { key: "LSO-WPSK77" };
    await signIn();
    expect(readActivationKey()).toBe("LSO-WPSK77");
    cleanup();
    window.localStorage.clear();
    mocks.signIn.mockClear();
    mocks.search = {};
    markActivationKey("STORED-ONLY-1");
    await signIn();
    await waitFor(() => expect(window.localStorage.getItem(KEY_STORAGE)).toBeNull());
  });

  it("e. a redeem with ok false keeps the key, shows the line, logs the reason", async () => {
    mocks.search = { intent: "personal", key: "LSO-WPSK77" };
    mocks.lookup.mockResolvedValue({ ok: false, institution_name: null });
    mocks.redeem.mockResolvedValue({ ok: false, reason: "needs_workspace" });
    markActivationKey("LSO-WPSK77");
    render(
      <Suspense fallback={null}>
        <onbOpts.component />
      </Suspense>,
    );
    await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Liam" } });
    mocks.profile = { id: "p1" };
    fireEvent.submit(screen.getByRole("button", { name: /create my workspace/i }).closest("form")!);
    expect(await screen.findByText(KEY_KEPT_COPY, undefined, { timeout: 10000 })).toBeTruthy();
    expect(readActivationKey()).toBe("LSO-WPSK77");
    expect(mocks.logEvent).toHaveBeenCalledWith("activation.redeem_failed", expect.anything(), {
      reason: "needs_workspace",
    });
    expect(KEY_KEPT_COPY).not.toContain("\u2014");
  });

  it("i. the one code field sends an activation key to /j/$code", () => {
    render(<PlansPage />);
    fireEvent.change(screen.getByLabelText("Enter the code you were sent"), { target: { value: "LSO-WPSK77" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/j/$code", params: { code: "LSO-WPSK77" } });
  });

  it("j. the one code field sends an invite code to /join", () => {
    render(<PlansPage />);
    fireEvent.change(screen.getByLabelText("Enter the code you were sent"), { target: { value: "INVITE77" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/join", search: { code: "INVITE77" } });
  });

  it("k. an unrecognised code shows the message and stays put", () => {
    render(<PlansPage />);
    fireEvent.change(screen.getByLabelText("Enter the code you were sent"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(CODE_ENTRY_ERROR)).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("l. a signed-in visitor with a key sees both choices instead of a redirect", async () => {
    mocks.search = { key: "LSO-WPSK77" };
    mocks.authEntryUser = { id: "u1", email: "current@example.com" };
    mocks.profile = { id: "p1", org_id: "o1", org_name: "Current Workspace" };
    render(<Suspense fallback={null}><authOpts.component /></Suspense>);
    expect(await screen.findByRole("heading", { name: "You are already signed in" })).toBeTruthy();
    expect(screen.getByText("current@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use this key on Current Workspace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out and set this up as a new account" })).toBeTruthy();
  });

  it("m. signing out returns to auth with the same key", async () => {
    mocks.search = { key: "LSO-WPSK77", intent: "personal" };
    mocks.authEntryUser = { id: "u1", email: "current@example.com" };
    mocks.profile = { id: "p1", org_id: "o1", org_name: "Current Workspace" };
    render(<Suspense fallback={null}><authOpts.component /></Suspense>);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out and set this up as a new account" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/auth",
      search: { intent: "personal", key: "LSO-WPSK77" },
      replace: true,
    });
  });

  it("n. successful signup shows the address and disables resend for 30 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.search = { key: "LSO-WPSK77", intent: "personal" };
    render(<Suspense fallback={null}><authOpts.component /></Suspense>);
    fireEvent.click(await screen.findByText("Need an account? Sign up"));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("PASSWORD"), { target: { value: "secret12" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(screen.getByText("new@example.com")).toBeTruthy();
    const resend = screen.getByRole("button", { name: "Resend email" });
    fireEvent.click(resend);
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "new@example.com" })));
    expect(screen.getByRole("button", { name: "Resend in 30s" }).hasAttribute("disabled")).toBe(true);
    vi.useRealTimers();
  });
});
