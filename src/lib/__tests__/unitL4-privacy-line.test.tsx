// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NEUTRAL_COPY, REGISTER_COPY, type Register } from "@/lib/register";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    options: opts,
    useSearch: () => mocks.search,
  }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  redirect: (value: unknown) => value,
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({
    invalidateQueries: async () => {},
    removeQueries: () => {},
  }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    rpc: async () => ({ error: null }),
  },
}));
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => null }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/client-telemetry", () => ({
  aliasSignupVisitor: vi.fn(),
  emitClientEvent: vi.fn(),
}));
vi.mock("@/lib/posthog-client", () => ({ identifyPostHog: vi.fn() }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));

import { Route as AuthRoute } from "@/routes/auth";
import { Route as OnboardingRoute } from "@/routes/onboarding";

type RouteOptions = { component: () => ReactNode };

const authOptions = (AuthRoute as unknown as { options: RouteOptions }).options;
const onboardingOptions = (OnboardingRoute as unknown as { options: RouteOptions }).options;
const registers = Object.keys(REGISTER_COPY) as Register[];

beforeAll(async () => {
  const auth = authOptions.component as unknown as { preload?: () => Promise<unknown> };
  const onboarding = onboardingOptions.component as unknown as { preload?: () => Promise<unknown> };
  await Promise.all([auth.preload?.(), onboarding.preload?.()]);
}, 30_000);
afterEach(cleanup);

describe("Unit L4: register privacy line", () => {
  it.each(registers)("setup renders the %s privacy line", (register) => {
    mocks.search = { intent: register };
    const Setup = onboardingOptions.component;
    render(
      <Suspense fallback={null}>
        <Setup />
      </Suspense>,
    );
    expect(await screen.findByText(REGISTER_COPY[register].privacy)).toBeTruthy();
  });

  it("auth without a door signal renders the neutral privacy line", () => {
    mocks.search = {};
    const Auth = authOptions.component;
    render(
      <Suspense fallback={null}>
        <Auth />
      </Suspense>,
    );
    expect(await screen.findByText(NEUTRAL_COPY.privacy)).toBeTruthy();
  });

  it("changes only the company privacy string", () => {
    expect(REGISTER_COPY.company.privacy).toBe(
      "Nobody reads your threads. Your work is private to you until you share it.",
    );
    expect(REGISTER_COPY.personal.privacy).toBe("Nobody reads your threads.");
    expect(REGISTER_COPY.edu.privacy).toBe("Not your professor, not your school.");
    expect(REGISTER_COPY.partner.privacy).toBe(
      "You see what people send you, and nothing else.",
    );
    expect(NEUTRAL_COPY.privacy).toBe("Nobody reads your threads.");
  });
});