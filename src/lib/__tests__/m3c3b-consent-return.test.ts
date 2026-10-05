import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("@/integrations/supabase/client", async (orig) => {
  const real = await orig<{ supabase: { auth: Record<string, unknown> } }>();
  return {
    ...real,
    supabase: new Proxy(real.supabase, {
      get(target, prop, receiver) {
        if (prop === "auth") {
          return new Proxy(target.auth, {
            get(a, p, r) {
              if (p === "getUser") return async () => ({ data: { user: mocks.user }, error: null });
              return Reflect.get(a, p, r);
            },
          });
        }
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

import { consentNext, consentTarget } from "../consent-return";
import { getRouter } from "@/router";
import { Route as AuthRoute } from "@/routes/auth";

describe("M3-C3b consent return", () => {
  it("accepts a well-formed consent next", () => {
    expect(consentTarget("/oauth/consent?authorization_id=abc-123_X")).toEqual({ authorization_id: "abc-123_X" });
  });

  it("rejects everything else", () => {
    for (const bad of [
      "//evil.com/oauth/consent?authorization_id=a",
      "https://evil.com/oauth/consent?authorization_id=a",
      "/oauth/consentx?authorization_id=a",
      "/oauth/consent",
      "/oauth/consent?authorization_id=<script>",
      "/join?code=X",
    ]) {
      expect(consentTarget(bad)).toBeNull();
    }
  });

  it("consentNext round-trips", () => {
    expect(consentTarget(consentNext("auth-1"))).toEqual({ authorization_id: "auth-1" });
  });

  it("registers /oauth/consent", () => {
    const router = getRouter();
    const paths = Object.values(router.routesById).map((r) => (r as { fullPath?: string }).fullPath);
    expect(paths).toContain("/oauth/consent");
  });

  const beforeLoad = (AuthRoute.options as unknown as {
    beforeLoad: (a: { search: Record<string, unknown> }) => Promise<unknown>;
  }).beforeLoad;

  it("a signed-in person with a consent next is sent to the consent page", async () => {
    mocks.user = { id: "u1" };
    const thrown = await beforeLoad({ search: { next: consentNext("auth-1") } }).catch((e: unknown) => e);
    const options = (thrown as { options?: Record<string, unknown> }).options ?? (thrown as Record<string, unknown>);
    expect(options["to"]).toBe("/oauth/consent");
    expect(options["search"]).toEqual({ authorization_id: "auth-1" });
  });

  it("a join next behaves as before", async () => {
    mocks.user = { id: "u1" };
    await expect(beforeLoad({ search: { next: "/join?code=X" } })).resolves.toBeUndefined();
  });
});
