// @vitest-environment jsdom
// N4: the create RPC carries p_type, so the BEFORE INSERT trigger derives the
// right tier from settings->>'type' at the very first write. This defect was a
// missing property, not wrong logic: drop p_type again and these tests go red.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: { intent: "personal" } as Record<string, unknown>,
  navigate: vi.fn(),
  rpc: vi.fn(),
  profilesRead: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    options: opts,
    useSearch: () => mocks.search,
  }),
  Link: (props: { children?: ReactNode }) => createElement("a", null, props.children),
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
      return Promise.resolve({ error: null, data: null });
    },
    from: (table: string) => {
      if (table === "people") return { upsert: async () => ({ error: null }) };
      if (table !== "profiles") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            is: () => mocks.profilesRead(),
          }),
        }),
      };
    },
  },
}));
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
  mocks.search.intent = "personal";
  mocks.navigate.mockReset();
  mocks.rpc.mockReset();
  mocks.profilesRead.mockReset();
});
afterEach(() => cleanup());

async function submitSetup(workspaceName?: string) {
  const Component = opts.component;
  render(createElement(Component));
  await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Liam" } });
  if (workspaceName) {
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: workspaceName },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Work" }));
  fireEvent.submit(screen.getByRole("button", { name: /create my workspace/i }).closest("form")!);
}

const createCalls = () =>
  mocks.rpc.mock.calls.filter((c) => c[0] === "create_org_with_profile");

describe("Unit N4: the create call passes the workspace type", () => {
  it("a company choice creates the workspace with p_type company", async () => {
    mocks.search.intent = "company";
    mocks.profilesRead.mockResolvedValue({ data: [], error: null });
    await submitSetup("Northwind Group");
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0]?.[1]).toMatchObject({
      p_type: "company",
      p_org_name: "Northwind Group",
    });
  });

  it("a personal choice creates the workspace with p_type personal", async () => {
    mocks.profilesRead.mockResolvedValue({ data: [], error: null });
    await submitSetup();
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0]?.[1]).toMatchObject({
      p_type: "personal",
      p_display_name: "Liam",
    });
  });

  it("the create call never carries p_signup_source", async () => {
    mocks.profilesRead.mockResolvedValue({ data: [], error: null });
    await submitSetup();
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0]?.[1]).not.toHaveProperty("p_signup_source");
  });
});
