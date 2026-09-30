import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headers: Record<string, string> = {};
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => headers[name],
}));

let v2Inserts: Record<string, unknown>[] = [];
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        v2Inserts.push(row);
        return { error: null };
      },
    }),
  },
}));

vi.mock("../org-type.server", () => ({
  orgTypeFromSettings: () => "company",
  workspaceStamp: async () => ({ workspace_type: "company", affiliated: false }),
  partnerSlugOf: async () => null,
  accountStageOf: async () => "pilot",
}));

vi.mock("../profile-resolve", () => ({
  resolveProfile: async () => ({ id: "prof-1", org_id: "org-1" }),
}));

vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));

import {
  computeActorHash,
  mirrorDistinctId,
  resetConsentCache,
  sha256Hex,
} from "../telemetry.server";
import { hmacHex, recordEventV2 } from "../telemetry-v2.server";

function fakeSupabase(tier: string) {
  return {
    from: (table: string) => {
      if (table === "data_consent_state") {
        return {
          select: () => ({
            eq: async () => ({
              data: [{ scope: "org", tier, ledger_version: 1, profile_id: null }],
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { name: "Acme", data_use_tier: "operate", settings: {} },
            }),
          }),
        }),
      };
    },
  } as never;
}

let fetchMock: ReturnType<typeof vi.fn>;
function posthogBodies() {
  return fetchMock.mock.calls
    .filter((c) => String(c[0]).includes("posthog"))
    .map((c) => JSON.parse((c[1] as { body: string }).body));
}

const input = {
  eventName: "consent.presented" as const,
  props: { purpose_count: 4, policy_version: "p1" },
  profileId: "prof-1",
};

beforeEach(() => {
  process.env["TELEMETRY_SALT"] = "salt";
  delete process.env["LASSO_ENVIRONMENT"];
  headers["host"] = "lasso.charlotte-labs.com";
  resetConsentCache();
  v2Inserts = [];
  fetchMock = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("V2-1 mirrorDistinctId", () => {
  it("never mirrors at t0", () => {
    expect(mirrorDistinctId("t0", "stable")).toBeNull();
  });
  it("uses a fresh id at a", () => {
    const one = mirrorDistinctId("a", "stable");
    const two = mirrorDistinctId("a", "stable");
    expect(one).not.toBe(two);
    expect(one).not.toBe("stable");
    expect(two).not.toBe("stable");
  });
  it("keeps the stable id at b, c and d", () => {
    for (const tier of ["b", "c", "d"] as const) {
      expect(mirrorDistinctId(tier, "stable")).toBe("stable");
    }
  });
});

describe("V2-1 recordEventV2 gate", () => {
  it("at t0 stores the row and sends nothing to PostHog", async () => {
    await recordEventV2(fakeSupabase("t0"), "user-1", input);
    expect(v2Inserts).toHaveLength(1);
    expect(posthogBodies()).toHaveLength(0);
  });

  it("at c mirrors with the v1 identity and full context", async () => {
    await recordEventV2(fakeSupabase("c"), "user-1", input);
    const bodies = posthogBodies();
    expect(bodies).toHaveLength(1);
    const body = bodies[0];
    expect(body.properties.$groups.org).toBe(await sha256Hex("org-1"));
    expect(body.distinct_id).toBe(await computeActorHash("user-1"));
    expect(body.properties.environment).toBe("production");
    expect(body.properties.account_stage).toBe("pilot");
    expect(body.properties.actor_kind).toBe("person");
  });

  it("keeps the HMAC tenant on the events_v2 row", async () => {
    await recordEventV2(fakeSupabase("c"), "user-1", input);
    const row = v2Inserts[0]!;
    expect(row["tenant_pseudo"]).toBe(await hmacHex("salt", "org-1"));
    expect(row["tenant_pseudo"]).not.toBe(await sha256Hex("org-1"));
  });
});
