// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  rpc: vi.fn(),
  submitPilot: vi.fn(),
  pendingRows: [] as unknown[],
  pendingInvite: null as null | { code: string; eng?: string },
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    options: opts,
    useSearch: () => mocks.search,
  }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  redirect: (x: unknown) => x,
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {}, removeQueries: () => {} }),
}));
vi.mock("@tanstack/react-start", async (orig) => ({
  ...(await orig<object>()),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/pilot-request.functions", () => ({
  PILOT_TEAM_SIZES: ["1-5", "6-15", "16-40", "40+"],
  submitSignupPilotRequestFn: (...a: unknown[]) => {
    mocks.submitPilot(...a);
    return Promise.resolve({ ok: true });
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: { id: "u1", email: "jo@firm.com", user_metadata: { full_name: "Jo" } } },
        error: null,
      }),
    },
    rpc: (...args: unknown[]) => {
      mocks.rpc(...args);
      return Promise.resolve({ error: null });
    },
    from: (table: string) => {
      if (table === "people") return { upsert: async () => ({ error: null }) };
      if (table === "pilot_requests")
        return { select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: mocks.pendingRows }) }) }) }) };
      return { select: () => ({ eq: () => ({ is: async () => ({ data: [], error: null }) }) }) };
    },
  },
}));
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => null, AUTH_USER_KEY: ["auth-user"] }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => mocks.pendingInvite }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: vi.fn() }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({ EnterInviteCode: () => null }));

import { Route } from "@/routes/onboarding";

type Opts = {
  component: (() => ReactNode) & { preload?: () => Promise<void> };
  beforeLoad: (a: { search: Record<string, unknown> }) => Promise<unknown>;
};
const opts = (Route as unknown as { options: Opts }).options;

vi.setConfig({ testTimeout: 30000 });
beforeAll(async () => {
  await opts.component.preload?.();
}, 30000);
beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.submitPilot.mockReset();
  mocks.pendingRows = [];
  mocks.pendingInvite = null;
});
afterEach(cleanup);

function mount(intent: string) {
  mocks.search = { intent };
  const C = opts.component;
  render(
    <Suspense fallback={null}>
      <C />
    </Suspense>,
  );
}

describe("GATE-1: company signup asks for a pilot", () => {
  it("company register shows the request form and never calls create_org_with_profile", async () => {
    mount("company");
    await screen.findByRole("button", { name: "Request a pilot" }, { timeout: 25000 });
    expect(screen.queryByRole("button", { name: /create my workspace/i })).toBeNull();
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "jo@firm.com");
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Artemis" } });
    fireEvent.submit(screen.getByRole("button", { name: "Request a pilot" }).closest("form")!);
    await screen.findByTestId("pilot-pending");
    expect(mocks.submitPilot).toHaveBeenCalledWith({
      data: { name: "Jo", firm: "Artemis", team_size: "1-5" },
    });
    expect(mocks.rpc.mock.calls.some((c) => c[0] === "create_org_with_profile")).toBe(false);
  });

  it("partner register is gated the same way", async () => {
    mount("partner");
    await screen.findByRole("button", { name: "Request a pilot" }, { timeout: 25000 });
  });

  it("a pending request renders the pending state", async () => {
    mocks.pendingRows = [{ id: "r1" }];
    mount("company");
    await screen.findByText("Request received. We will email you when your workspace is ready.", undefined, {
      timeout: 25000,
    });
    expect(screen.queryByRole("button", { name: "Request a pilot" })).toBeNull();
  });

  it("personal register still calls create_org_with_profile", async () => {
    mount("personal");
    await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Liam" } });
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    fireEvent.submit(screen.getByRole("button", { name: /create my workspace/i }).closest("form")!);
    await waitFor(() =>
      expect(mocks.rpc.mock.calls.some((c) => c[0] === "create_org_with_profile" && (c[1] as { p_type: string }).p_type === "personal")).toBe(true),
    );
  });

  it("an invited company person goes straight to /join, with no pilot gate", async () => {
    mocks.pendingInvite = { code: "ABC-123" };
    await expect(opts.beforeLoad({ search: { intent: "company" } })).rejects.toMatchObject({
      to: "/join",
      search: { code: "ABC-123" },
    });
    const join = readFileSync("src/routes/join.tsx", "utf8");
    expect(join).toContain('supabase.rpc("join_org_with_invite"');
    expect(join).not.toMatch(/pilot/i);
  });
});
