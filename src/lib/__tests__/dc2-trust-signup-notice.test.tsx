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
  Link: ({ children, to, hash }: { children: ReactNode; to: string; hash?: string }) => <a href={to + (hash ? `#${hash}` : "")}>{children}</a>,
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

vi.mock("@/components/layout/PublicHeader", () => ({ PublicHeader: () => null }));
vi.mock("@/lib/board-invites.functions", () => ({ checkBoardInviteSignup: vi.fn() }));
vi.mock("@/lib/data-consent.functions", () => ({ setDataConsent: vi.fn() }));

import { createHash } from "node:crypto";
import { SIGNUP_DEFAULT_NOTICE, SIGNUP_DEFAULT_TEXT_VERSION, TIER_COPY, DEFAULT_ORG_TIER, DEFAULT_USER_TIER } from "@/lib/data-consent-shared";
import { Route as AuthRoute } from "@/routes/auth";
import { Route as SetupRoute } from "@/routes/onboarding";
import { COPY as TRUST_COPY, Route as TrustRoute } from "@/routes/trust";

type Options = { component: (() => ReactNode) & { preload?: () => Promise<unknown> } };
const options = (route: unknown) => (route as { options: Options }).options;
const routes = [AuthRoute, SetupRoute, TrustRoute];
beforeAll(async () => { for (const route of routes) await options(route).component.preload?.(); }, 30000);
beforeEach(() => { mocks.search = {}; mocks.authEntryUser = null; mocks.profile = null; window.localStorage.clear(); });
afterEach(cleanup);
function mount(route: unknown) {
  const Component = options(route).component;
  return render(<Suspense fallback={null}><Component /></Suspense>);
}
const HASH = "027f91861ced05322ec7e1da2808d4b413f8a33fb420a857b3f78d54812637da";
const BANNED = /\b(monitor|monitoring|track|audit|surveillance|score|telemetry|analytics|spy)\b|\u2014/i;
describe("DC-2 starting-level disclosure", () => {
  it("pins the exact dc-signup-v1 notice fingerprint without changing legacy defaults", () => {
    expect(SIGNUP_DEFAULT_TEXT_VERSION).toBe("dc-signup-v1");
    expect(createHash("sha256").update(SIGNUP_DEFAULT_NOTICE).digest("hex")).toBe(HASH);
    expect(DEFAULT_ORG_TIER).toBe("c");
    expect(DEFAULT_USER_TIER).toBe("b");
    expect(SIGNUP_DEFAULT_NOTICE).not.toMatch(BANNED);
  });
  it("shows the verbatim notice after Create account in signup", async () => {
    mocks.search = { mode: "signup" };
    mount(AuthRoute);
    const notice = await screen.findByTestId("signup-default-notice");
    expect(notice.querySelector("p")?.textContent).toBe(SIGNUP_DEFAULT_NOTICE);
    expect(notice.querySelector("a")?.getAttribute("href")).toBe("/trust");
    expect(screen.getByRole("button", { name: "Create account" }).compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Already have an account? Sign in" }));
    expect(screen.queryByTestId("signup-default-notice")).toBeNull();
  });
  it("does not show a starting-level notice on sign-in", async () => {
    mount(AuthRoute);
    await screen.findByRole("button", { name: "Sign in", exact: true });
    expect(screen.queryByText(SIGNUP_DEFAULT_NOTICE)).toBeNull();
  });
  it("does not show it to an existing signed-in account with an invite", async () => {
    mocks.search = { mode: "signup", invite: "existing-invite" };
    mocks.authEntryUser = { id: "u1" };
    mount(AuthRoute);
    await screen.findByText("You are already signed in");
    expect(screen.queryByText(SIGNUP_DEFAULT_NOTICE)).toBeNull();
  });
  it.each(["personal", "company", "partner", "edu"])("shows it below the uses question for new %s setup", async (intent) => {
    mocks.search = { intent };
    mount(SetupRoute);
    const notice = await screen.findByTestId("signup-default-notice");
    expect(notice.querySelector("p")?.textContent).toBe(SIGNUP_DEFAULT_NOTICE);
    expect(screen.getByText("What will you use Lasso for? Pick any that fit.").compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "See what each level means" }).getAttribute("href")).toBe("/trust#levels");
  });
  it("does not show it on existing-account tool setup", async () => {
    mocks.search = { setup: true };
    mount(SetupRoute);
    await screen.findByText("Where do you work with AI?");
    expect(screen.queryByText(SIGNUP_DEFAULT_NOTICE)).toBeNull();
  });
  it("renders truthful Trust text without banned words, em dashes or the old claim", async () => {
    const view = mount(TrustRoute);
    await screen.findByRole("heading", { name: TRUST_COPY.heading });
    const text = view.container.textContent ?? "";
    expect(text).not.toMatch(BANNED);
    expect(text).not.toContain("Content-free");
    for (const tier of TIER_COPY) expect(text).toContain(tier.label);
    for (const title of TRUST_COPY.titles) expect(text).toContain(title);
    expect(view.container.querySelector("#levels")?.textContent).toContain(TRUST_COPY.levelsRights);
    expect(text).toContain(TRUST_COPY.measurement);
    expect(text).toContain("Email delivery.");
  });
});
