// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  signUp: vi.fn(async (_args: { options: { emailRedirectTo: string } }) => ({
    data: { user: { id: "u1", identities: [{}] }, session: null },
    error: null,
  })),
  lookup: vi.fn(async () => ({ ok: true, institution_name: "Harbor College" })),
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
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
      getSession: async () => ({ data: { session: null } }),
      signUp: mocks.signUp,
      signInWithPassword: async () => ({ error: null }),
    },
    rpc: async () => ({ error: null }),
  },
}));
vi.mock("@/lib/activation-keys.functions", () => ({
  lookupActivationKeyFn: mocks.lookup,
  redeemActivationKeyFn: vi.fn(async () => ({ ok: true, reason: "redeemed" })),
}));
vi.mock("@/lib/invites.functions", () => ({ checkSignupInvite: vi.fn() }));
vi.mock("@/lib/client-telemetry", () => ({ aliasSignupVisitor: vi.fn(), emitClientEvent: vi.fn() }));
vi.mock("@/lib/posthog-client", () => ({ identifyPostHog: vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => null, AUTH_USER_KEY: ["auth-user"] }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/layout/EntryDoorLink", () => ({ EntryDoorLink: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({ EnterInviteCode: () => null }));

import { KEY_STORAGE, KEY_TTL_MS, markActivationKey, readActivationKey } from "@/lib/key-entry";
import { Route as AuthRoute } from "@/routes/auth";
import { KEY_NOTICE_COPY, Route as OnboardingRoute } from "@/routes/onboarding";

type Opts = { component: (() => ReactNode) & { preload?: () => Promise<unknown> } };
const authOpts = (AuthRoute as unknown as { options: Opts }).options;
const onbOpts = (OnboardingRoute as unknown as { options: Opts }).options;

vi.setConfig({ testTimeout: 30000 });
beforeAll(async () => {
  await authOpts.component.preload?.();
  await onbOpts.component.preload?.();
}, 30000);
beforeEach(() => {
  window.localStorage.clear();
  mocks.signUp.mockClear();
  mocks.navigate.mockClear();
});
afterEach(cleanup);

function mount(C: () => ReactNode) {
  return render(
    <Suspense fallback={null}>
      <C />
    </Suspense>,
  );
}

describe("KX1: saved key expiry", () => {
  it("returns a fresh key and drops one older than 60 minutes", () => {
    markActivationKey("artemis-pilot-27");
    expect(readActivationKey()).toBe("ARTEMIS-PILOT-27");
    window.localStorage.setItem(
      KEY_STORAGE,
      JSON.stringify({ code: "ARTEMIS-PILOT-27", savedAt: Date.now() - KEY_TTL_MS - 1000 }),
    );
    expect(readActivationKey()).toBeNull();
    expect(window.localStorage.getItem(KEY_STORAGE)).toBeNull();
  });

  it("treats a legacy bare string as expired and clears it", () => {
    window.localStorage.setItem(KEY_STORAGE, "ARTEMIS-PILOT-27");
    expect(readActivationKey()).toBeNull();
    expect(window.localStorage.getItem(KEY_STORAGE)).toBeNull();
  });
});

describe("KX1: confirm email never carries a stored key", () => {
  async function signUp() {
    mount(authOpts.component);
    const toggle = await screen.findByText("Need an account? Sign up", undefined, { timeout: 25000 });
    fireEvent.click(toggle);
    fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: "a@b.com" } });
    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "secret12" } });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalled());
    return mocks.signUp.mock.calls[0]![0].options.emailRedirectTo;
  }

  it("leaves a key that exists only in storage out of emailRedirectTo", async () => {
    mocks.search = { intent: "personal" };
    markActivationKey("STORED-ONLY-99");
    const url = await signUp();
    expect(url).toContain("/onboarding?intent=personal");
    expect(url).not.toContain("STORED-ONLY-99");
    expect(url).not.toContain("key=");
  });

  it("still carries a key that is in the current link", async () => {
    mocks.search = { intent: "personal", key: "LINK-KEY-1" };
    const url = await signUp();
    expect(url).toContain("key=LINK-KEY-1");
  });
});

describe("KX1: carried key is shown and removable", () => {
  it("names the institution and Remove clears it", async () => {
    mocks.search = { intent: "personal", key: "ARTEMIS-PILOT-27" };
    markActivationKey("ARTEMIS-PILOT-27");
    mount(onbOpts.component);
    await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
    expect(await screen.findByText(KEY_NOTICE_COPY.named("Harbor College"))).toBeTruthy();
    expect(screen.getByText(KEY_NOTICE_COPY.body)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: KEY_NOTICE_COPY.remove }));
    await waitFor(() => expect(screen.queryByTestId("key-notice")).toBeNull());
    expect(window.localStorage.getItem(KEY_STORAGE)).toBeNull();
    expect(mocks.navigate).toHaveBeenCalled();
  });

  it("shows no notice when nothing is carried", async () => {
    mocks.search = { intent: "personal" };
    mount(onbOpts.component);
    await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
    expect(screen.queryByTestId("key-notice")).toBeNull();
  });

  it("copy has no em dash", () => {
    const all = [KEY_NOTICE_COPY.named("X"), KEY_NOTICE_COPY.neutral, KEY_NOTICE_COPY.body, KEY_NOTICE_COPY.remove];
    for (const s of all) expect(s).not.toContain("\u2014");
  });
});
