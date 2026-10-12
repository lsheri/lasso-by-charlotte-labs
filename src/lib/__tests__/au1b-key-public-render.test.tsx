// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: { key: "LSO-MADEUP" } as Record<string, unknown>,
  lookup: vi.fn(),
  publicCheck: vi.fn(async () => ({ valid: false, institution_name: null })),
  keyOpts: null as null | { queryFn: () => Promise<{ ok: boolean }>; enabled: boolean },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {}, removeQueries: vi.fn() }),
  useQuery: (opts: { queryKey: unknown[]; queryFn: () => Promise<{ ok: boolean }>; enabled: boolean }) => {
    if (opts.queryKey[0] === "auth-entry-user") return { data: null };
    if (opts.queryKey[0] === "auth-entry-key") {
      mocks.keyOpts = opts;
      return { data: { ok: false, institution_name: null } };
    }
    return { data: undefined };
  },
}));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts, useSearch: () => mocks.search }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  redirect: (x: unknown) => x,
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-start", async (orig) => ({ ...(await orig<object>()), useServerFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) } },
}));
vi.mock("@/lib/activation-keys.functions", () => ({
  lookupActivationKeyFn: mocks.lookup,
  redeemActivationKeyFn: vi.fn(),
  checkActivationKeyPublic: mocks.publicCheck,
}));
vi.mock("@/lib/invites.functions", () => ({ checkSignupInvite: vi.fn() }));
vi.mock("@/lib/board-invites.functions", () => ({ checkBoardInviteSignup: vi.fn() }));
vi.mock("@/lib/client-telemetry", () => ({ aliasSignupVisitor: vi.fn(), emitClientEvent: vi.fn() }));
vi.mock("@/lib/posthog-client", () => ({ identifyPostHog: vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({ fetchProfile: async () => null, AUTH_USER_KEY: ["auth-user"] }));
vi.mock("@/components/layout/EntryDoorLink", () => ({ EntryDoorLink: ({ children }: { children: ReactNode }) => <>{children}</> }));

import { Route as AuthRoute } from "@/routes/auth";

afterEach(cleanup);

describe("AU-1b signed out with a made-up key", () => {
  it("shows the invalid line and no sponsored line, using the public check", async () => {
    const Comp = (AuthRoute as unknown as { options: { component: () => JSX.Element } }).options.component;
    console.log("COMP", String(Comp).slice(0, 200));
    render(<Comp />);
    // The query the page runs signed out goes through the public check.
    expect(mocks.keyOpts?.enabled).toBe(true);
    expect(await mocks.keyOpts!.queryFn()).toEqual({ ok: false, institution_name: null });
    expect(await screen.findByText("This key link is not valid. Ask whoever sent it for a new one.")).toBeTruthy();
    expect(screen.queryByTestId("key-notice")).toBeNull();
    expect(screen.queryByText(/sponsored key/i)).toBeNull();
    expect(mocks.publicCheck).toHaveBeenCalled();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
