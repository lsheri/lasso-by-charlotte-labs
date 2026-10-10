// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  orgUpdates: [] as Array<Record<string, unknown>>,
  logV2: vi.fn(),
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
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    rpc: async () => ({ data: "org-1", error: null }),
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => {
        if (table === "orgs") mocks.orgUpdates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          is: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  },
}));
vi.mock("@/hooks/use-profile", () => ({
  fetchProfile: async () => ({ id: "p1", org_id: "org-1" }),
}));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn(), logV2: mocks.logV2 }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({ EnterInviteCode: () => null }));

import { USE_FOR_OPTIONS } from "@/lib/org-segments";
import { Route } from "@/routes/onboarding";

type Opts = { component: () => ReactNode };
const opts = (Route as unknown as { options: Opts }).options;

vi.setConfig({ testTimeout: 30000 });
beforeAll(async () => {
  const c = opts.component as unknown as { preload?: () => Promise<unknown> };
  await c.preload?.();
}, 30000);
afterEach(cleanup);

async function reachSegment(intent: "company" | "personal") {
  mocks.search = { intent };
  mocks.orgUpdates.length = 0;
  mocks.logV2.mockClear();
  render(
    <Suspense fallback={null}>
      {opts.component()}
    </Suspense>,
  );
  await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sam" } });
  if (intent === "company") {
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Acme" } });
  }
  fireEvent.click(screen.getByRole("button", { name: /Create/ }));
  await screen.findByText("One thing before you start.", undefined, { timeout: 25000 });
}

describe("SEG-1b: the individual question in the segment step", () => {
  it("stores exactly the three values the constraint accepts", () => {
    expect(USE_FOR_OPTIONS.map((o) => o.value)).toEqual(["work", "school", "other"]);
    expect(USE_FOR_OPTIONS.map((o) => o.label)).toEqual(["Work", "School", "Other"]);
  });

  it("personal reaches the segment stage and sees one question, not Industry or People", async () => {
    await reachSegment("personal");
    expect(screen.getByText("What is this for")).toBeTruthy();
    expect(screen.queryByText("Industry")).toBeNull();
    expect(screen.queryByText("People")).toBeNull();
  });

  it("company still sees Industry and People and not the question", async () => {
    await reachSegment("company");
    expect(screen.getByText("Industry")).toBeTruthy();
    expect(screen.getByText("People")).toBeTruthy();
    expect(screen.queryByText("What is this for")).toBeNull();
  });

  it("personal with nothing chosen saves only use_for: null", async () => {
    await reachSegment("personal");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(mocks.orgUpdates).toHaveLength(1));
    expect(mocks.orgUpdates[0]).toEqual({ use_for: null });
  });

  it("skip writes nothing", async () => {
    await reachSegment("personal");
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await screen.findByText("Where do you work with AI?", undefined, { timeout: 25000 });
    expect(mocks.orgUpdates).toHaveLength(0);
  });
});
