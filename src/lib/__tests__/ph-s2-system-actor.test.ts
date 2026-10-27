import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headers: Record<string, string> = {};
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => headers[name],
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ insert: async () => ({ error: null }) }) },
}));

vi.mock("../org-type.server", () => ({
  workspaceStamp: async () => ({ workspace_type: "edu", affiliated: true }),
  partnerSlugOf: async () => "ceiba_uni",
}));

vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));

import { computeActorHash, recordEvent, resetConsentCache } from "../telemetry.server";

let insertCalls: Record<string, unknown>[];
function fakeSupabase(tier: string | null) {
  insertCalls = [];
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
      return {
        insert: async (row: Record<string, unknown>) => {
          insertCalls.push(row);
          return { error: null };
        },
      };
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
  resetConsentCache();
  fetchMock = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("PH-S2 system actor mirror", () => {
  it("userId null at t2 mirrors under the system stand-in with actor_kind system", async () => {
    await recordEvent(fakeSupabase("t2"), {
      eventType: "extract.generated",
      orgId: "o1",
      userId: null,
      dims: {},
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [b] = bodies();
    const standIn = await computeActorHash("system:o1");
    expect(standIn).not.toBeNull();
    expect(b.distinct_id).toBe(standIn);
    expect(b.properties.actor_kind).toBe("system");
    expect(b.properties.$process_person_profile).toBe(false);
  });

  it("the events row for a system event keeps actor_hash null", async () => {
    const sb = fakeSupabase("t2");
    await recordEvent(sb, {
      eventType: "extract.generated",
      orgId: "o1",
      userId: null,
      dims: {},
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.["actor_hash"]).toBeNull();
  });

  it("with a user the mirror joins the auth id while storage keeps the hash", async () => {
    await recordEvent(fakeSupabase("t2"), {
      eventType: "invite.blocked",
      orgId: "o1",
      userId: "u1",
      dims: {},
    });
    const [b] = bodies();
    expect(b.distinct_id).toBe("u1");
    expect(insertCalls[0]?.["actor_hash"]).toBe(await computeActorHash("u1"));
    expect(b.properties.$process_person_profile).toBe(true);
    expect(b.properties.actor_kind).toBe("person");
  });

  it("tier a uses fresh person-less per-event ids", async () => {
    const sb = fakeSupabase("a");
    const input = { eventType: "invite.blocked" as const, orgId: "o1", userId: "u1", dims: {} };
    await recordEvent(sb, input);
    await recordEvent(sb, input);
    const [first, second] = bodies();
    expect(first.distinct_id).not.toBe("u1");
    expect(first.distinct_id).not.toBe(second.distinct_id);
    expect(first.properties.$process_person_profile).toBe(false);
    expect(second.properties.$process_person_profile).toBe(false);
  });

  it("joinable b, c and d tiers mirror under the auth id", async () => {
    for (const tier of ["b", "c", "d"]) {
      resetConsentCache();
      await recordEvent(fakeSupabase(tier), { eventType: "invite.blocked", orgId: "o1", userId: "u1" });
      const body = bodies().at(-1);
      expect(body.distinct_id).toBe("u1");
      expect(body.properties.$process_person_profile).toBe(true);
    }
  });

  it("t0 with a user never mirrors", async () => {
    await recordEvent(fakeSupabase("t0"), { eventType: "invite.blocked", orgId: "o1", userId: "u1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("t0 with userId null sends nothing", async () => {
    await recordEvent(fakeSupabase("t0"), {
      eventType: "extract.generated",
      orgId: "o1",
      userId: null,
      dims: {},
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
