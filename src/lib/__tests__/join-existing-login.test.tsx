// @vitest-environment jsdom
// 20 Nov 2026: an invited person who already has a login. Live answers sign-up for an existing address with the error
// "User already registered"; the page used to show it raw and stay on Create account. Now the typed password is tried
// as a sign-in and they go straight on to the invite; a wrong password switches to sign in with a plain line.
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
  checkActivationKeyPublic: vi.fn(async () => ({ valid: true, institution_name: null })),
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

import { readFileSync } from "node:fs";

import { EXISTING_ACCOUNT_WRONG_PASSWORD, isAlreadyRegisteredError, isExistingAccountSignup } from "@/lib/signup-existing";
import { Route as AuthRoute } from "@/routes/auth";

type Opts = { component: (() => ReactNode) & { preload?: () => Promise<unknown> } };
const authOpts = (AuthRoute as unknown as { options: Opts }).options;

vi.setConfig({ testTimeout: 30000 });
beforeAll(async () => {
  await authOpts.component.preload?.();
}, 30000);
beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mocks.profile = null;
  mocks.authEntryUser = null;
  mocks.search = { next: "/join?code=abc123def456" };
  mocks.inviteCheck = { ok: true, email: "dana@example.test", org_name: "Alder Row Partners" };
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(cleanup);

const ALREADY = { data: { user: null, session: null }, error: { message: "User already registered", code: "user_already_exists", status: 422 } };

function renderAuth() {
  const Page = authOpts.component;
  render(
    <Suspense fallback={null}>
      <Page />
    </Suspense>,
  );
}

async function submitSignUp(password = "the-right-one") {
  const box = (await screen.findByLabelText(/password/i)) as HTMLInputElement;
  fireEvent.change(box, { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("an invited person who already has a login", () => {
  it("reads both of Supabase's answers for an existing address, and no other error", () => {
    expect(isExistingAccountSignup(ALREADY.data, ALREADY.error)).toBe(true);
    expect(isExistingAccountSignup({ user: null, session: null }, { message: "A user with this email address has already been registered" })).toBe(true);
    expect(isExistingAccountSignup({ user: null, session: null }, { code: "email_exists" })).toBe(true);
    expect(isExistingAccountSignup({ user: { identities: [] }, session: null }, null)).toBe(true);
    expect(isAlreadyRegisteredError({ message: "Password should be at least 6 characters" })).toBe(false);
    expect(isAlreadyRegisteredError(null)).toBe(false);
  });

  it("is signed in with the password they typed and goes straight on to the invite", async () => {
    mocks.signUp.mockResolvedValueOnce(ALREADY as never);
    mocks.signIn.mockResolvedValueOnce({ error: null });
    renderAuth();
    await submitSignUp();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/join", search: { code: "abc123def456" }, replace: true }));
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "dana@example.test", password: "the-right-one" });
    expect(screen.queryByText("User already registered")).toBeNull();
  });

  it("with a different password, switches to sign in with a plain line instead of the raw error", async () => {
    mocks.signUp.mockResolvedValueOnce(ALREADY as never);
    mocks.signIn.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } } as never);
    renderAuth();
    await submitSignUp("a-new-one");
    expect(await screen.findByText(EXISTING_ACCOUNT_WRONG_PASSWORD)).toBeTruthy();
    expect(screen.queryByText("User already registered")).toBeNull();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();

    // The next press signs in with the account's own password and goes on to the invite.
    mocks.signIn.mockResolvedValueOnce({ error: null });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "the-right-one" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/join", search: { code: "abc123def456" }, replace: true }));
  });

  it("still shows any other sign-up error as it is, and tries no sign-in", async () => {
    mocks.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: "Password should be at least 6 characters" } } as never);
    renderAuth();
    await submitSignUp("123");
    expect(await screen.findByText("Password should be at least 6 characters")).toBeTruthy();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
});

describe("the creator's own view of a locked invite", () => {
  it("says it is locked to an address, not that it is an open link", () => {
    const join = readFileSync("src/routes/join.tsx", "utf8");
    const creator = join.slice(join.indexOf("if (state.created_by_you)"), join.indexOf('if (blocked === "already_member")'));
    expect(creator.indexOf("state.is_email_bound")).toBeGreaterThan(-1);
    expect(creator.indexOf("state.is_email_bound")).toBeLessThan(creator.indexOf("It is an open link"));
  });
});

describe("the join page names the four roles", () => {
  it("calls a Member invite a member, not a teammate", () => {
    const join = readFileSync("src/routes/join.tsx", "utf8");
    expect(join).toMatch(/em: "member"/);
    expect(join).not.toMatch(/em: "teammate"/);
  });
});

