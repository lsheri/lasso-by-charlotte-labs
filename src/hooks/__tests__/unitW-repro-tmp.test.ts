import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [{ id: "p1", user_id: "u1", org_id: "o1", role: "em", display_name: "A", deactivated_at: null, orgs: null }],
              error: null,
            }),
        }),
      }),
    }),
  },
}));

const mod = await import("@/hooks/use-profile");

describe("repro", () => {
  it("a failed or signed-out identity read is cached and outlives staleTime", async () => {
    const client = new QueryClient();
    mod.resetProfileIdentityState();
    mod.registerProfileQueryClient(client);
    // Session expired or network blip: getUser yields no user.
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("blip") });
    expect(await mod.ensureAuthUser()).toBeNull();
    // Push the cached null two minutes into the past (well beyond staleTime 60s).
    client.setQueryData(mod.AUTH_USER_KEY, null, { updatedAt: Date.now() - 120_000 });
    // Person signs in: getUser now succeeds.
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const state = await mod.fetchProfileState();
    console.log("REPRO profiles after sign-in:", state.profiles.length, "getUser calls:", getUser.mock.calls.length);
    expect(state.profiles.length).toBe(0);
    expect(await mod.fetchProfile()).toBeNull();
  });
});
