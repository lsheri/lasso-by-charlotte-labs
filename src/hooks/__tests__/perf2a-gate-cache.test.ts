import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  rows: [] as Record<string, unknown>[],
  getUser: vi.fn(),
  profilesCalls: 0,
  authCb: null as null | ((event: string, session: unknown) => void),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: h.getUser,
      getSession: async () => ({ data: { session: h.user ? { user: h.user } : null } }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        h.authCb = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => {
            h.profilesCalls += 1;
            return { data: h.rows, error: null };
          },
        }),
      }),
    }),
  },
}));
vi.mock("@/components/layout/AppShell", () => ({ AppShell: () => null }));

import { fetchProfile, registerProfileQueryClient, resetProfileIdentityState } from "@/hooks/use-profile";
import { Route } from "@/routes/_authenticated/route";

const row = (over: Record<string, unknown> = {}) => ({
  id: "p1", user_id: "u1", org_id: "o1", role: "admin", display_name: "Liam",
  title_band: null, onboarding: null, created_at: "2026-01-01", deactivated_at: null,
  orgs: { name: "Org", settings: { type: "company" }, clients_enabled: true }, ...over,
});

async function gate(): Promise<{ redirect?: string }> {
  const run = (Route.options as { beforeLoad: () => Promise<unknown> }).beforeLoad;
  try {
    await run();
    return {};
  } catch (thrown) {
    const t = thrown as { options?: { to?: string }; to?: string };
    return { redirect: t.options?.to ?? t.to ?? "unknown" };
  }
}

let client: QueryClient;
beforeEach(() => {
  resetProfileIdentityState();
  h.user = { id: "u1" };
  h.rows = [row()];
  h.profilesCalls = 0;
  h.getUser.mockReset();
  h.getUser.mockImplementation(async () => ({ data: { user: h.user }, error: h.user ? null : { name: "AuthSessionMissingError" } }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  registerProfileQueryClient(client);
});

describe("PERF-2a signed-in gate cache", () => {
  it("(a) two navigations within 60s ask once for identity and profiles", async () => {
    expect(await gate()).toEqual({});
    expect(await gate()).toEqual({});
    expect(h.getUser.mock.calls.length).toBeLessThanOrEqual(1);
    expect(h.profilesCalls).toBe(1);
    expect(client.getQueryData(["profiles"])).toHaveLength(1);
  });

  it("(b) after SIGNED_OUT the next run fetches again and redirects to /auth", async () => {
    await gate();
    h.user = null;
    h.authCb?.("SIGNED_OUT", null);
    expect(await gate()).toEqual({ redirect: "/auth" });
    expect(h.getUser).toHaveBeenCalledTimes(2);
  });

  it("(c) no profiles goes to /onboarding; only deactivated goes to /no-access", async () => {
    h.rows = [];
    expect(await gate()).toEqual({ redirect: "/onboarding" });
    client.removeQueries({ queryKey: ["profile-state"] });
    h.rows = [row({ deactivated_at: "2026-02-01" })];
    expect(await gate()).toEqual({ redirect: "/no-access" });
  });

  it("(PERF-2d) two fetchProfile() calls within 60s ask for profiles once", async () => {
    expect((await fetchProfile())?.id).toBe("p1");
    expect((await fetchProfile())?.id).toBe("p1");
    expect(h.profilesCalls).toBe(1);
  });

  it("invalidating the profile list also refreshes the gate copy", async () => {
    await gate();
    await client.invalidateQueries({ queryKey: ["profiles"] });
    await gate();
    expect(h.profilesCalls).toBe(2);
  });
});
