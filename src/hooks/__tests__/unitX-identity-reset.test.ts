import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const listeners: ((event: string, session: { user: { id: string } } | null) => void)[] = [];
const unsubscribe = vi.fn();

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => getUser(),
      onAuthStateChange: (cb: (typeof listeners)[number]) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                { id: "p1", user_id: "u1", org_id: "o1", role: "em", display_name: "A", deactivated_at: null, orgs: null },
              ],
              error: null,
            }),
        }),
      }),
    }),
  },
}));

const mod = await import("@/hooks/use-profile");

function emit(event: string, userId: string | null) {
  for (const l of listeners) l(event, userId ? { user: { id: userId } } : null);
}

let client: QueryClient;
beforeEach(() => {
  mod.resetProfileIdentityState();
  listeners.length = 0;
  getUser.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mod.registerProfileQueryClient(client);
});

describe("Unit X: the identity cache never serves a false 'no user'", () => {
  it("does not persist a failed getUser as null", async () => {
    const blip = Object.assign(new Error("network"), { name: "AuthRetryableFetchError" });
    getUser.mockResolvedValueOnce({ data: { user: null }, error: blip });
    await expect(mod.ensureAuthUser()).rejects.toThrow("network");
    expect(client.getQueryData(mod.AUTH_USER_KEY)).toBeUndefined();

    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect(await mod.ensureAuthUser()).toEqual({ id: "u1" });
    expect((await mod.fetchProfileState()).profiles).toHaveLength(1);
  });

  it("sign-out then sign-in does not serve the pre-sign-in value", async () => {
    const missing = Object.assign(new Error("Auth session missing!"), { name: "AuthSessionMissingError" });
    getUser.mockResolvedValue({ data: { user: null }, error: missing });
    emit("SIGNED_OUT", null);
    expect(await mod.ensureAuthUser()).toBeNull();
    // Aged well past staleTime, the shape that minted the phantom workspace.
    client.setQueryData(mod.AUTH_USER_KEY, null, { updatedAt: Date.now() - 120_000 });

    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    emit("SIGNED_IN", "u1");
    const state = await mod.fetchProfileState();
    expect(state.profiles).toHaveLength(1);
    expect(await mod.fetchProfile()).not.toBeNull();
  });

  it("registers one listener however often the client is registered, and unsubscribes on reset", () => {
    mod.registerProfileQueryClient(client);
    mod.registerProfileQueryClient(client);
    expect(listeners).toHaveLength(1);
    mod.resetProfileIdentityState();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("a repeat SIGNED_IN for the same person keeps the good cache", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await mod.ensureAuthUser();
    emit("SIGNED_IN", "u1");
    expect(client.getQueryData(mod.AUTH_USER_KEY)).toEqual({ id: "u1" });
    emit("SIGNED_IN", "u2");
    expect(client.getQueryData(mod.AUTH_USER_KEY)).toBeUndefined();
  });
});
