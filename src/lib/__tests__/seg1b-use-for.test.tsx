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
      upsert: async () => ({ error: null }),
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
vi.mock("@/lib/telemetry-v2", () => ({ logV2: mocks.logV2 }));
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
  // The later path reaches the first-run tour, which reads media queries.
  window.matchMedia ??= ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
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
  fireEvent.click(screen.getByRole("button", { name: "Work" }));
  fireEvent.click(screen.getByRole("button", { name: /Create/ }));
  // ONB-Q1: the segment question is a row on the tools step, not its own screen.
  await screen.findByText("Where do you work with AI?", undefined, { timeout: 25000 });
  expect(screen.queryByText("One thing before you start.")).toBeNull();
  expect(screen.getByText("It helps us compare like with like, never you with anyone.")).toBeTruthy();
}

/** The segment write, apart from the tools step's own settings write. */
const segmentWrites = () => mocks.orgUpdates.filter((p) => !("settings" in p));

describe("SEG-1b / ONB-Q1: the individual question in the tools step row", () => {
  it("stores exactly the three values the constraint accepts", () => {
    expect(USE_FOR_OPTIONS.map((o) => o.value)).toEqual(["work", "school", "other"]);
    expect(USE_FOR_OPTIONS.map((o) => o.label)).toEqual(["Work", "School", "Other"]);
  });

  it("personal reaches the segment stage and sees one question, not Industry or People", async () => {
    await reachSegment("personal");
    expect(screen.getByText("This is for")).toBeTruthy();
    for (const label of ["Work", "School", "Other"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(screen.queryByText("Industry")).toBeNull();
    expect(screen.queryByText("People")).toBeNull();
  });

  it("company still sees Industry and People and not the question", async () => {
    await reachSegment("company");
    expect(screen.getByText("Industry")).toBeTruthy();
    expect(screen.getByText("People")).toBeTruthy();
    expect(screen.queryByText("This is for")).toBeNull();
  });

  it("personal with nothing chosen saves only use_for: null", async () => {
    await reachSegment("personal");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(segmentWrites()).toHaveLength(1));
    expect(segmentWrites()[0]).toEqual({ use_for: null, country: null });
    await waitFor(() => expect(mocks.logV2).toHaveBeenCalledWith("organization.segment_updated", { fields_set: 0 }, { profileId: "p1" }));
  });

  it("a chosen chip saves its stored value", async () => {
    await reachSegment("personal");
    fireEvent.click(screen.getByRole("button", { name: "School" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(segmentWrites()).toHaveLength(1));
    expect(segmentWrites()[0]).toEqual({ use_for: "school", country: null });
    await waitFor(() => expect(mocks.logV2).toHaveBeenCalledWith("organization.segment_updated", { fields_set: 1 }, { profileId: "p1" }));
  });

  it("leaving the tools step for later writes nothing and fires nothing", async () => {
    await reachSegment("personal");
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "I'll do this later" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.orgUpdates).toHaveLength(0);
    expect(mocks.logV2).not.toHaveBeenCalledWith("organization.segment_updated", expect.anything(), expect.anything());
  });

  it("ONB-Q1b: on ?setup=1, answering only Country leaves use_for out of the write", async () => {
    mocks.search = { intent: "personal", setup: true };
    mocks.orgUpdates.length = 0;
    mocks.logV2.mockClear();
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    render(
      <Suspense fallback={null}>
        {opts.component()}
      </Suspense>,
    );
    const trigger = await screen.findByRole("combobox", { name: "Country" }, { timeout: 25000 });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(segmentWrites()).toHaveLength(1));
    const payload = segmentWrites()[0];
    expect(payload).not.toHaveProperty("use_for");
    expect(payload).toHaveProperty("country");
    await waitFor(() => expect(mocks.logV2).toHaveBeenCalledWith("organization.segment_updated", { fields_set: 1 }, { profileId: "p1" }));
  });
});
