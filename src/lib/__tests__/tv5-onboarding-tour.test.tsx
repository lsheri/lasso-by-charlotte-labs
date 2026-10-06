// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: { setup: true } as Record<string, unknown>,
  navigate: vi.fn(),
  profile: null as Record<string, unknown> | null,
  updates: [] as unknown[],
  tourProps: [] as Record<string, unknown>[],
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts, useSearch: () => mocks.search }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  redirect: (x: unknown) => x,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {}, removeQueries: () => {} }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => async () => null }));
vi.mock("@/lib/activation-keys.functions", () => ({ lookupActivationKeyFn: {}, redeemActivationKeyFn: {} }));
vi.mock("@/integrations/supabase/client", () => {
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order"]) b[m] = () => b;
    b["update"] = (value: unknown) => { mocks.updates.push(value); return b; };
    b["maybeSingle"] = async () => ({ data: { org_id: "o1", settings: { type: "personal" } }, error: null });
    b["then"] = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
    return b;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
      rpc: async () => ({ data: null, error: null }),
      from: () => builder(),
    },
  };
});
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => mocks.profile, AUTH_USER_KEY: ["auth-user"] }));
vi.mock("@/lib/onboarding-tools", () => ({ loadToolsUsed: async () => [], saveToolsUsed: async () => null, toolCountBucket: () => "0" }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/onboarding/OnboardingTour", () => ({
  OnboardingTour: (props: { register: string; orgId: string | null; onDone: () => void }) => {
    mocks.tourProps.push(props);
    return (
      <div data-testid="tour-stub">
        <button type="button" onClick={props.onDone}>stub finish</button>
        <button type="button" onClick={props.onDone}>stub skip</button>
      </div>
    );
  },
}));

import { Route, firstRunTourPending } from "@/routes/onboarding";

const opts = (Route as unknown as { options: { component: () => ReactNode } }).options;
vi.setConfig({ testTimeout: 30000 });
beforeAll(async () => {
  const c = opts.component as unknown as { preload?: () => Promise<unknown> };
  await c.preload?.();
}, 30000);
beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.updates = [];
  mocks.tourProps = [];
  mocks.profile = { id: "p1", org_id: "o1", org_type: "edu", onboarding: { welcome_seen: false, checklist: "open" } };
});
afterEach(cleanup);

async function mount(search: Record<string, unknown>) {
  mocks.search = search;
  const Component = opts.component;
  render(<Suspense fallback={null}><Component /></Suspense>);
}

/** A new person: create the workspace, then leave the tools step. */
async function reachTourGate() {
  await mount({ intent: "personal" });
  const name = await screen.findByLabelText("Your name", undefined, { timeout: 25000 });
  fireEvent.change(name, { target: { value: "Jordan" } });
  fireEvent.click(screen.getByRole("button", { name: "Create my workspace" }));
  await screen.findByText("Where do you work with AI?", undefined, { timeout: 25000 });
  fireEvent.click(screen.getByRole("button", { name: "I'll do this later" }));
}

const welcomeSeenWrites = () =>
  mocks.updates.filter((u) => (u as { onboarding?: { welcome_seen?: boolean } }).onboarding?.welcome_seen === true);

describe("TV5 the tour is the onboarding step", () => {
  it("the gate: first run only, never for ?setup=1 or a person who has completed it", () => {
    expect(firstRunTourPending(false, { onboarding: { welcome_seen: false } })).toBe(true);
    expect(firstRunTourPending(false, { onboarding: null })).toBe(true);
    expect(firstRunTourPending(false, { onboarding: { welcome_seen: true } })).toBe(false);
    expect(firstRunTourPending(true, { onboarding: { welcome_seen: false } })).toBe(false);
    expect(firstRunTourPending(false, null)).toBe(false);
  });

  it("a new person sees the tour, with the register from their own workspace", async () => {
    await reachTourGate();
    await screen.findByTestId("tour-stub");
    expect(mocks.tourProps.at(-1)).toMatchObject({ register: "edu", orgId: "o1" });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it.each(["stub finish", "stub skip"])("%s uses the route's existing completion path and remembers it", async (control) => {
    await reachTourGate();
    fireEvent.click(await screen.findByRole("button", { name: control }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/home", replace: true });
    await waitFor(() => expect(welcomeSeenWrites()).toHaveLength(1));
    expect(welcomeSeenWrites()[0]).toEqual({ onboarding: { welcome_seen: true, checklist: "open" } });
  });

  it("a person who has already completed it does not see the tour again", async () => {
    mocks.profile = { ...mocks.profile, onboarding: { welcome_seen: true, checklist: "open" } };
    await reachTourGate();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/home", replace: true }));
    expect(screen.queryByTestId("tour-stub")).toBeNull();
    expect(welcomeSeenWrites()).toHaveLength(0);
  });

  it("an existing member reopening setup never sees it", async () => {
    await mount({ setup: true });
    fireEvent.click(await screen.findByRole("button", { name: "I'll do this later" }, { timeout: 25000 }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/home", replace: true }));
    expect(screen.queryByTestId("tour-stub")).toBeNull();
  });

  it("onboarding source renders the tour, not FlowPreview", () => {
    const route = readFileSync("src/routes/onboarding.tsx", "utf8");
    expect(route).toContain("<OnboardingTour");
    const tour = readFileSync("src/components/onboarding/OnboardingTour.tsx", "utf8");
    expect(tour).toContain("<TourStage");
    expect(tour).toContain("useTourActRenderers");
  });

  it("FlowPreview has zero references", () => {
    const out = execSync(`grep -rn "FlowPreview\\|FLOW_PREVIEW" src tests --exclude=tv5-onboarding-tour.test.tsx || true`, { encoding: "utf8" });
    expect(out.trim()).toBe("");
  });
});
