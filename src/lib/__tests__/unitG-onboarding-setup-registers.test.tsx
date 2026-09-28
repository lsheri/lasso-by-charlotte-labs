// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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
  redirect: (x: unknown) => x,
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    rpc: async () => ({ error: null }),
  },
}));
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => null }));
vi.mock("@/lib/pending-invite", () => ({ readPendingInvite: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));
vi.mock("@/components/onboarding/SetupTools", () => ({ SetupTools: () => null }));
vi.mock("@/components/onboarding/ToolPicker", () => ({ ToolPicker: () => null }));
vi.mock("@/components/invites/EnterInviteCode", () => ({ EnterInviteCode: () => null }));

import { Route } from "@/routes/onboarding";

type Opts = {
  component: () => ReactNode;
  beforeLoad: (a: { search: Record<string, unknown> }) => Promise<unknown>;
};
const opts = (Route as unknown as { options: Opts }).options;

async function mount(intent: "company" | "personal" | "edu") {
  mocks.search = { intent };
  // Signed-in check with no profile: must not redirect.
  await expect(opts.beforeLoad({ search: mocks.search })).resolves.toBeUndefined();
  const Component = opts.component;
  const view = render(
    <Suspense fallback={null}>
      <Component />
    </Suspense>,
  );
  // The route component is code-split; wait for the setup heading.
  await screen.findByText("What should we call you?", undefined, { timeout: 25000 });
  return view;
}

vi.setConfig({ testTimeout: 30000 });
// The code-split route chunk loads cold on first mount; warm it once.
beforeAll(async () => {
  await mount("personal");
  cleanup();
}, 30000);
afterEach(cleanup);

describe("Unit G: onboarding setup stage per register", () => {
  it("company", async () => {
    await mount("company");
    expect(screen.getByText("Your organization")).toBeTruthy();
    expect(screen.getByText("What should we call you?")).toBeTruthy();
    expect(screen.getByText("Two details and you are in. Both are yours to change later.")).toBeTruthy();
    expect(screen.getByLabelText("Your name")).toBeTruthy();
    expect(screen.getByLabelText("Workspace name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create my workspace" })).toBeTruthy();
    expect(screen.getByText("One board. Every tool. Circle a few chats and ask.")).toBeTruthy();
  });

  it("personal", async () => {
    await mount("personal");
    expect(screen.getByText("Just you")).toBeTruthy();
    expect(screen.getByText("One detail and you are in. Yours to change later.")).toBeTruthy();
    expect(screen.getByLabelText("Your name")).toBeTruthy();
    expect(screen.queryByLabelText("Workspace name")).toBeNull();
    expect(screen.getByText("Stop losing the chat where you worked it out.")).toBeTruthy();
  });

  it("edu", async () => {
    await mount("edu");
    expect(screen.getByText("Your school work")).toBeTruthy();
    expect(screen.getByText("One detail and you are in. Yours to change later.")).toBeTruthy();
    expect(screen.queryByLabelText("Workspace name")).toBeNull();
    expect(
      screen.getByText("Your AI chats are where the thinking happened. Put them where the work is."),
    ).toBeTruthy();
  });

  it.each(["company", "personal", "edu"] as const)(
    "%s: no chooser, no why stage",
    async (intent) => {
      const { container } = await mount(intent);
      const text = container.textContent ?? "";
      expect(text).not.toContain("Who is this for?");
      expect(text).not.toContain("The point of all this");
    },
  );

  it("never says firm, consultancy or consulting in any register", async () => {
    for (const intent of ["company", "personal", "edu"] as const) {
      const { container } = await mount(intent);
      expect(container.textContent ?? "").not.toMatch(/\b(firm|consultancy|consulting)\b/i);
      cleanup();
    }
  });
});
