// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: { intent: "personal" } as Record<string, unknown>,
  navigate: vi.fn(),
  rpc: vi.fn(),
  profilesRead: vi.fn(),
  eqArgs: [] as unknown[][],
  isArgs: [] as unknown[][],
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
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    rpc: (...args: unknown[]) => {
      mocks.rpc(...args);
      return Promise.resolve({ error: null });
    },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (...a: unknown[]) => {
            mocks.eqArgs.push(a);
            return {
              is: (...b: unknown[]) => {
                mocks.isArgs.push(b);
                return mocks.profilesRead();
              },
            };
          },
        }),
      };
    },
  },
}));
// The cached path deliberately says "no profile", as the stale cache did.
vi.mock("@/hooks/use-profile", () => ({
  fetchProfile: async () => null,
  AUTH_USER_KEY: ["auth-user"],
}));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({ EnterInviteCode: () => null }));

import { Route } from "@/routes/onboarding";

type Opts = { component: (() => ReactNode) & { preload?: () => Promise<void> } };
const opts = (Route as unknown as { options: Opts }).options;

vi.setConfig({ testTimeout: 30000 });

beforeAll(async () => {
  await opts.component.preload?.();
});

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.rpc.mockReset();
  mocks.profilesRead.mockReset();
  mocks.eqArgs = [];
  mocks.isArgs = [];
});
afterEach(() => cleanup());

async function submit() {
  const Component = opts.component;
  render(
    <Suspense fallback={null}>
      <Component />
    </Suspense>,
  );
  await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Liam" } });
  fireEvent.submit(screen.getByRole("button", { name: /create my workspace/i }).closest("form")!);
}

describe("Unit W: the setup form never creates a second workspace", () => {
  it("an existing profile goes to /work and nothing is created", async () => {
    mocks.profilesRead.mockResolvedValue({ data: [{ id: "p1" }], error: null });
    await submit();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/work", replace: true }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.eqArgs).toContainEqual(["user_id", "u1"]);
    expect(mocks.isArgs).toContainEqual(["deactivated_at", null]);
  });

  it("zero profiles creates the workspace as before", async () => {
    mocks.profilesRead.mockResolvedValue({ data: [], error: null });
    await submit();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    expect(mocks.rpc.mock.calls[0]?.[0]).toBe("create_org_with_profile");
  });

  it("a failed read refuses to create and shows the error", async () => {
    mocks.profilesRead.mockResolvedValue({ data: null, error: { message: "network" } });
    await submit();
    await screen.findByText(/Nothing was created/);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
