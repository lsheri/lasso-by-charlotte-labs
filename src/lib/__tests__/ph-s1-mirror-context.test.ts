import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headers: Record<string, string> = {};
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => headers[name],
}));

const insert = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ insert }) },
}));

vi.mock("../org-type.server", () => ({
  workspaceStamp: async () => ({ workspace_type: "edu", affiliated: true }),
  partnerSlugOf: async () => "ceiba_uni",
}));

vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));

import {
  recordAnonymousEvent,
  recordEvent,
  resetConsentCache,
} from "../telemetry.server";

function fakeSupabase(tier: string | null) {
  return {
    from: (table: string) => {
      if (table === "data_consent_state") {
        return {
          select: () => ({
            eq: async () => ({
              data: tier ? [{ scope: "org", tier, ledger_version: 1, profile_id: null }] : [],
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    },
  } as never;
}

let fetchMock: ReturnType<typeof vi.fn>;
function bodies() {
  return fetchMock.mock.calls.map((c) => JSON.parse((c[1] as { body: string }).body));
}

beforeEach(() => {
  process.env["TELEMETRY_SALT"] = "salt";
  for (const k of Object.keys(headers)) delete headers[k];
  headers["host"] = "lasso.charlotte-labs.com";
  headers["user-agent"] = "UA/1.0";
  resetConsentCache();
  fetchMock = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("PH-S1 mirror context", () => {
  it("signed-in mirror carries context, geoip off, no $ip, dims unchanged", async () => {
    headers["cf-connecting-ip"] = "1.2.3.4";
    const dims = { state: "x", mode: "sync" };
    await recordEvent(fakeSupabase("t2"), {
      eventType: "invite.blocked",
      orgId: "o1",
      userId: "u1",
      dims,
    });
    const [b] = bodies();
    const p = b.properties;
    expect(p.environment).toBe("production");
    expect(p.workspace_type).toBe("edu");
    expect(p.affiliated).toBe(true);
    expect(p.partner).toBe("ceiba_uni");
    expect(p.$geoip_disable).toBe(true);
    expect(p.$raw_user_agent).toBe("UA/1.0");
    expect("$ip" in p).toBe(false);
    expect(p.$groups).toBeDefined();
    expect(p.state).toBe("x");
    expect(p.mode).toBe("sync");
    expect(dims).toEqual({ state: "x", mode: "sync" });
  });

  it("anonymous mirror carries $ip and no $groups", async () => {
    headers["cf-connecting-ip"] = "9.9.9.9";
    await recordAnonymousEvent("landing.viewed" as never, "v1", { variant: "a" });
    const [b] = bodies();
    expect(b.properties.$ip).toBe("9.9.9.9");
    expect("$groups" in b.properties).toBe(false);
    expect(b.properties.workspace_type).toBe("none");
    expect(b.properties.partner).toBe("none");
    expect(b.properties.variant).toBe("a");
  });

  it("t0 sends nothing to PostHog", async () => {
    await recordEvent(fakeSupabase("t0"), {
      eventType: "invite.blocked",
      orgId: "o2",
      userId: "u1",
      dims: {},
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
