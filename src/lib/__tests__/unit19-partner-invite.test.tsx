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
  logEvent: vi.fn(),
  navigate: vi.fn(),
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
  useQueryClient: () => ({ invalidateQueries: async () => {}, removeQueries: () => {} }),
  useQuery: () => ({ data: undefined }),
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
      signUp: vi.fn(),
      signInWithPassword: mocks.signIn,
    },
    rpc: async () => ({ data: "p1", error: null }),
    from: () => {
      const chain: Record<string, unknown> = {};
      const done = Promise.resolve({ data: [], error: null });
      for (const k of ["select", "eq", "is", "update", "insert"]) chain[k] = () => chain;
      chain["maybeSingle"] = async () => ({ data: null, error: null });
      chain["then"] = done.then.bind(done);
      return chain;
    },
  },
}));
vi.mock("@/lib/activation-keys.functions", () => ({
  lookupActivationKeyFn: mocks.lookup,
  redeemActivationKeyFn: mocks.redeem,
}));
vi.mock("@/lib/invites.functions", () => ({ checkSignupInvite: vi.fn() }));
vi.mock("@/lib/client-telemetry", () => ({ aliasSignupVisitor: vi.fn(), emitClientEvent: vi.fn() }));
vi.mock("@/lib/posthog-client", () => ({ identifyPostHog: vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => null, AUTH_USER_KEY: ["auth-user"] }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/layout/EntryDoorLink", () => ({ EntryDoorLink: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({ EnterInviteCode: () => null }));

import { KEY_STORAGE, markActivationKey, readActivationKey } from "@/lib/key-entry";
import { Route as JRoute } from "@/routes/j.$code";
import { Route as AuthRoute } from "@/routes/auth";
import { KEY_KEPT_COPY, Route as OnbRoute } from "@/routes/onboarding";

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
    fireEvent.submit(screen.getByRole("button", { name: /create my workspace/i }).closest("form")!);
    expect(await screen.findByText(KEY_KEPT_COPY, undefined, { timeout: 10000 })).toBeTruthy();
    expect(readActivationKey()).toBe("LSO-WPSK77");
    expect(mocks.logEvent).toHaveBeenCalledWith("activation.redeem_failed", expect.anything(), {
      reason: "needs_workspace",
    });
    expect(KEY_KEPT_COPY).not.toContain("\u2014");
  });
});
