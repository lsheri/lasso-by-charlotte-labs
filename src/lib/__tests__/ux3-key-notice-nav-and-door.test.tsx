// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  profile: { id: "p1", org_id: "o1", org_type: "personal", role: "admin", clients_enabled: false },
  signUp: vi.fn(async (_args: { options: { emailRedirectTo: string } }) => ({
    data: { user: { id: "u1", identities: [{}] }, session: null },
    error: null,
  })),
  lookup: vi.fn(async () => ({ ok: true, institution_name: "Harbor College" })),
  navigate: vi.fn(),
  emitClientEvent: vi.fn(),
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
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {}, removeQueries: () => {}, getQueryData: () => undefined, getQueryCache: () => ({ subscribe: () => () => {} }) }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey[0] === "auth-entry-key" ? { ok: true, institution_name: "Harbor College" } : undefined }),
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
vi.mock("@/lib/client-telemetry", () => ({ aliasSignupVisitor: vi.fn(), emitClientEvent: mocks.emitClientEvent }));
vi.mock("@/lib/posthog-client", () => ({ identifyPostHog: vi.fn() }));
vi.mock("@/hooks/use-profile", async (original) => ({ ...(await original<object>()), fetchProfile: async () => null, AUTH_USER_KEY: ["auth-user"], useProfile: () => ({ data: mocks.profile, profiles: [mocks.profile] }) }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn(), bucket: () => "0" }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/layout/EntryDoorLink", () => ({ EntryDoorLink: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({ EnterInviteCode: () => null }));

import { KEY_STORAGE, KEY_TTL_MS, markActivationKey, readActivationKey } from "@/lib/key-entry";
import { Route as AuthRoute } from "@/routes/auth";
import { KEY_NOTICE_COPY, Route as OnboardingRoute } from "@/routes/onboarding";

vi.mock("@/hooks/use-engagements", () => ({
  useEngagements: () => ({ data: [] }),
}));
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: [] }),
  useInvalidateClients: () => () => {},
}));
vi.mock("@/components/engagements/SidebarCreateActions", () => ({
  SidebarCreateActions: () => (
    <>
      <button type="button">New client</button>
      <button type="button">New folder</button>
    </>
  ),
}));
vi.mock("@/hooks/use-affiliation", () => ({ useAffiliation: () => ({ data: null }) }));
vi.mock("@/hooks/use-coach-note-thread", () => ({ useUnreadNotesAboutMe: () => ({ data: [] }) }));
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => false }));
vi.mock("@/hooks/use-coaching-reach", () => ({ useCoachingReach: () => ({ canReach: false }) }));
vi.mock("@/hooks/use-shared-with-me", () => ({ useSharedWithMe: () => ({ groups: [] }) }));
vi.mock("@/hooks/use-decisions", () => ({ useDecisions: () => ({ data: [] }) }));

vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));


import { SidebarNav } from "@/components/layout/SidebarNav";

type Options = { component: (() => ReactNode) & { preload?: () => Promise<unknown> } };
const auth = (AuthRoute as unknown as { options: Options }).options.component;
const onboarding = (OnboardingRoute as unknown as { options: Options }).options.component;
beforeAll(async () => { await auth.preload?.(); await onboarding.preload?.(); }, 30000);
beforeEach(() => { mocks.search = {}; window.localStorage.clear(); });
afterEach(cleanup);
function mount(Component: () => ReactNode) { return render(<Suspense fallback={null}><Component /></Suspense>); }
function assertNotice() {
  const notice = screen.getByTestId("key-notice");
  const sentence = notice.querySelector("p");
  expect(sentence?.textContent).toBe(KEY_NOTICE_COPY.named("Harbor College"));
  const name = within(notice).getByText("Harbor College");
  expect(name.tagName).toBe("SPAN");
  expect(name.className).toBe("text-accent-deep");
  expect(within(notice).getByText(KEY_NOTICE_COPY.body)).toBeTruthy();
}
describe("UX-3", () => {
  it("auth renders the canonical named sentence with an isolated name above email", async () => {
    mocks.search = { key: "LSO-EXAMPLE", intent: "personal" };
    mount(auth);
    await screen.findByTestId("key-notice", undefined, { timeout: 25000 });
    assertNotice();
    const email = document.querySelector('input[type="email"]');
    expect(email && screen.getByTestId("key-notice").compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(KEY_NOTICE_COPY.remove)).toBeNull();
  });
  it("onboarding renders the same canonical sentence and isolated name", async () => {
    mocks.search = { key: "LSO-EXAMPLE", intent: "personal" };
    mount(onboarding);
    await waitFor(() => expect(screen.getByTestId("key-notice").textContent).toContain(KEY_NOTICE_COPY.named("Harbor College")), { timeout: 25000 });
    assertNotice();
  });
  it.each([
    ["personal", "Who you share with"], ["edu", "Who you share with"],
    ["company", "Run the firm"], ["partner", "Your practice"],
  ])("%s uses only the intended heading", (org_type, heading) => {
    mocks.profile.org_type = org_type;
    render(<SidebarNav />);
    expect(screen.getByText(heading)).toBeTruthy();
  });
  it("a carried key starts on signup and shows the notice", () => {
    mocks.search = { key: "LSO-EXAMPLE" };
    mount(auth);
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
    expect(screen.getByTestId("key-notice")).toBeTruthy();
  });
  it("an empty arrival starts on signin without a notice", () => {
    mount(auth);
    expect(screen.getByRole("button", { name: /^Sign in$/ })).toBeTruthy();
    expect(screen.queryByTestId("key-notice")).toBeNull();
  });
});
