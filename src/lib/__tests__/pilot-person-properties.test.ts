import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ email: vi.fn(), source: vi.fn(), profile: vi.fn(), insert: vi.fn() }));
// Mirror mock structure follows ph-s1-mirror-context.test.ts, with admin reads added.
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: mocks.email } },
    from: (table: string) => ({ insert: mocks.insert, select: () => ({ eq: (column: string, value: string) => ({ maybeSingle: () => table === "profiles" ? mocks.profile(column, value) : mocks.source() }) }) }),
  },
}));
vi.mock("../org-type.server", () => ({ workspaceStamp: async () => ({ workspace_type: "company", affiliated: false }), accountStageOf: async () => null }));
vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));

import { computeActorHash, recordAnonymousEvent, recordEvent, resetConsentCache, sha256Hex } from "../telemetry.server";

let fetchMock: ReturnType<typeof vi.fn>;
function sb(tier: string) {
  return { from: (table: string) => table === "data_consent_state"
    ? { select: () => ({ eq: async () => ({ data: [{ scope: "org", tier, ledger_version: 1, profile_id: null }] }) }) }
    : { insert: mocks.insert } } as never;
}
function send(key: string, tier = "c", userId: string | null = key) {
  return recordEvent(sb(tier), { eventType: "invite.blocked", userId, orgId: key, dims: { state: "x" }, payload: { title: "Private work" } });
}
function body() { return JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body); }
function settleLookups() { return new Promise<void>((resolve) => setTimeout(resolve, 0)); }
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetConsentCache();
  process.env["TELEMETRY_SALT"] = "salt";
  mocks.email.mockResolvedValue({ data: { user: { email: "pilot@example.test" } }, error: null });
  mocks.source.mockResolvedValue({ data: { signup_source: "direct" }, error: null });
  mocks.profile.mockResolvedValue({ data: { user_id: "resolved-auth-user" }, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  fetchMock = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
});

describe("non-blocking profile-to-auth mirror identity", () => {
  function sendProfile(profileId?: string, userId: string | null = null, tier = "c") {
    return recordEvent(sb(tier), { eventType: "ai.usage", orgId: "profile-org", profileId, userId,
      dims: { surface: "extract", cost_usd: 0.0123 } });
  }
  it("cold event resolves under the system stand-in before lookup; warm events join the auth person with one read", async () => {
    const lookup = deferred<{ data: { user_id: string }; error: null }>();
    mocks.profile.mockReturnValue(lookup.promise);
    let requestResolved = false;
    let lookupResolved = false;
    const request = sendProfile("profile-cold-warm").then(() => { requestResolved = true; });
    try {
      await vi.waitFor(() => expect(requestResolved).toBe(true));
      expect(lookupResolved).toBe(false);
      expect(body().distinct_id).toBe(await computeActorHash("system:profile-org"));
      expect(body().properties.actor_kind).toBe("system");
      expect(body().properties.$process_person_profile).toBe(false);
      expect(mocks.profile).toHaveBeenCalledExactlyOnceWith("id", "profile-cold-warm");
    } finally {
      lookupResolved = true;
      lookup.resolve({ data: { user_id: "resolved-auth-user" }, error: null });
    }
    await request;
    await settleLookups();
    await sendProfile("profile-cold-warm");
    expect(body().distinct_id).toBe("resolved-auth-user");
    expect(body().properties.actor_kind).toBe("person");
    expect(body().properties.$process_person_profile).toBe(true);
    expect(body().properties.$groups).toEqual({ org: await sha256Hex("profile-org") });
    expect(body().properties).not.toHaveProperty("title");
    for (const [row] of mocks.insert.mock.calls) {
      expect(row.actor_hash).toBeNull();
      expect(row.profile_id).toBe("profile-cold-warm");
      expect(row).not.toHaveProperty("user_id");
      expect(row).not.toHaveProperty("$process_person_profile");
    }
    await sendProfile("profile-cold-warm");
    expect(mocks.profile).toHaveBeenCalledTimes(1);
  });
  it("explicit userId never starts a profile lookup", async () => {
    await sendProfile("profile-explicit", "explicit-auth-user");
    expect(body().distinct_id).toBe("explicit-auth-user");
    expect(body().properties.$process_person_profile).toBe(true);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("neither identifier preserves hashed system behaviour", async () => {
    await sendProfile();
    expect(body().distinct_id).toBe(await computeActorHash("system:profile-org"));
    expect(body().properties.actor_kind).toBe("system");
    expect(body().properties.$process_person_profile).toBe(false);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("concurrent cold events share a read and cache null on failure", async () => {
    const lookup = deferred<{ data: null; error: { message: string } }>();
    mocks.profile.mockReturnValue(lookup.promise);
    try {
      await Promise.all([sendProfile("profile-null"), sendProfile("profile-null")]);
      expect(mocks.profile).toHaveBeenCalledTimes(1);
    } finally {
      lookup.resolve({ data: null, error: { message: "unavailable" } });
      await settleLookups();
    }
    await sendProfile("profile-null");
    expect(mocks.profile).toHaveBeenCalledTimes(1);
    expect(body().properties.$process_person_profile).toBe(false);
  });
  it("warm profile at tier a retains fresh per-event ids and no person profiling", async () => {
    await sendProfile("profile-tier-a");
    await settleLookups();
    resetConsentCache();
    await sendProfile("profile-tier-a", null, "a");
    const first = body().distinct_id;
    await sendProfile("profile-tier-a", null, "a");
    expect(body().distinct_id).not.toBe(first);
    expect(body().distinct_id).not.toBe("resolved-auth-user");
    expect(body().properties.$process_person_profile).toBe(false);
    expect(body().properties).not.toHaveProperty("$set");
  });
  it("t0 never mirrors or starts a profile lookup", async () => {
    await sendProfile("profile-t0", null, "t0");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("cached founder-only mirror person properties", () => {
  it("first cold event resolves before either lookup and later event carries sourced keys", async () => {
    const email = deferred<{ data: { user: { email: string } }; error: null }>();
    const source = deferred<{ data: { signup_source: string }; error: null }>();
    let lookupResolved = false;
    mocks.email.mockReturnValue(email.promise);
    mocks.source.mockReturnValue(source.promise);
    let requestResolved = false;
    const request = send("cold-first").then(() => { requestResolved = true; });
    try {
      await vi.waitFor(() => expect(requestResolved).toBe(true));
      expect(lookupResolved).toBe(false);
      expect(body().properties).not.toHaveProperty("$set");
      expect(mocks.email).toHaveBeenCalledExactlyOnceWith("cold-first");
      expect(mocks.source).toHaveBeenCalledTimes(1);
    } finally {
      lookupResolved = true;
      email.resolve({ data: { user: { email: "pilot@example.test" } }, error: null });
      source.resolve({ data: { signup_source: "direct" }, error: null });
    }
    await request;
    await settleLookups();
    await send("cold-first");
    expect(body().properties.$set).toEqual({ email: "pilot@example.test", signup_source: "direct" });
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.source).toHaveBeenCalledTimes(1);
  });
  it("joinable person sets only sourced email and signup_source, never stored or work content", async () => {
    await send("joinable");
    expect(body().properties).not.toHaveProperty("$set");
    await settleLookups();
    await send("joinable");
    expect(body().properties.$set).toEqual({ email: "pilot@example.test", signup_source: "direct" });
    expect(body().properties).not.toHaveProperty("title");
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty("email");
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty("signup_source");
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty("$set");
  });
  it("anonymous has no set and does no person reads", async () => {
    await recordAnonymousEvent("landing.viewed" as never, "anon");
    expect(body().properties).not.toHaveProperty("$set");
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it("system has no set and does no person reads", async () => {
    await send("system", "c", null);
    expect(body().properties).not.toHaveProperty("$set");
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it("tier a has no set and does no person reads", async () => {
    await send("anonymous-tier", "a");
    expect(body().properties).not.toHaveProperty("$set");
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it("t0 sends nothing and does no person reads", async () => {
    await send("lowest-tier", "t0");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it("two events reuse both cached lookups", async () => {
    await send("cached");
    await settleLookups();
    await send("cached");
    expect(mocks.email).toHaveBeenCalledExactlyOnceWith("cached");
    expect(mocks.source).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("concurrent misses share one lookup", async () => {
    const email = deferred<{ data: { user: null }; error: null }>();
    const source = deferred<{ data: null; error: null }>();
    mocks.email.mockReturnValue(email.promise);
    mocks.source.mockReturnValue(source.promise);
    try {
      await Promise.all([send("concurrent"), send("concurrent")]);
      expect(mocks.email).toHaveBeenCalledTimes(1);
      expect(mocks.source).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.every((call) => !JSON.parse(call[1].body).properties.$set)).toBe(true);
    } finally {
      email.resolve({ data: { user: null }, error: null });
      source.resolve({ data: null, error: null });
      await settleLookups();
    }
  });
  it("a new user sends only the already cached org key", async () => {
    await send("warm-org");
    await settleLookups();
    const email = deferred<{ data: { user: null }; error: null }>();
    mocks.email.mockReturnValue(email.promise);
    try {
      await send("warm-org", "c", "cold-user");
      expect(body().properties.$set).toEqual({ signup_source: "direct" });
      expect(mocks.email).toHaveBeenCalledTimes(2);
      expect(mocks.email).toHaveBeenNthCalledWith(2, "cold-user");
      expect(mocks.source).toHaveBeenCalledTimes(1);
    } finally {
      email.resolve({ data: { user: null }, error: null });
      await settleLookups();
    }
  });
  it("failed email read caches null while the event and source still send", async () => {
    mocks.email.mockRejectedValue(new Error("unavailable"));
    await send("failed-email");
    await settleLookups();
    await send("failed-email");
    expect(body().properties.$set).toEqual({ signup_source: "direct" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
  it("failed source response caches null while email still sends", async () => {
    mocks.source.mockResolvedValue({ data: { signup_source: "discard" }, error: { message: "unavailable" } });
    await send("failed-source");
    await settleLookups();
    await send("failed-source");
    expect(body().properties.$set).toEqual({ email: "pilot@example.test" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.source).toHaveBeenCalledTimes(1);
  });
  it("missing values cache null and omit set entirely", async () => {
    mocks.email.mockResolvedValue({ data: { user: null }, error: null });
    mocks.source.mockResolvedValue({ data: null, error: null });
    await send("missing");
    await settleLookups();
    await send("missing");
    expect(body().properties).not.toHaveProperty("$set");
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.source).toHaveBeenCalledTimes(1);
  });
  it("a hanging lookup cannot indefinitely block the mirror and is not retried", async () => {
    vi.useFakeTimers();
    mocks.email.mockImplementation(() => new Promise(() => {}));
    const request = send("hanging");
    await vi.waitFor(() => expect(mocks.email).toHaveBeenCalledTimes(1));
    await request;
    expect(body().properties).not.toHaveProperty("$set");
    await vi.advanceTimersByTimeAsync(1000);
    await send("hanging");
    expect(body().properties.$set).toEqual({ signup_source: "direct" });
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});