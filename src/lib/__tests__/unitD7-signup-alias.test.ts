import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aliasFn = vi.hoisted(() => vi.fn());
const identify = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry.functions", () => ({
  aliasSignupVisitorFn: aliasFn,
  recordAnonymousEventFn: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    identify,
    reset: vi.fn(),
    get_distinct_id: () => "ph-visitor-1",
  },
}));

import { resetSignupAlias } from "@/lib/client-telemetry";
import { aliasAnonymousVisitor } from "@/lib/telemetry.server";
import { noteSignUpIdentity } from "@/routes/auth";

beforeEach(() => {
  vi.stubGlobal("window", {});
  aliasFn.mockReset().mockResolvedValue({ ok: true });
  identify.mockClear();
  resetSignupAlias();
});
afterEach(() => vi.unstubAllGlobals());

describe("Unit D7: alias at sign-up", () => {
  it("sends the alias once on a successful sign-up", () => {
    noteSignUpIdentity({ user: { id: "auth-user-1" }, error: null });
    noteSignUpIdentity({ user: { id: "auth-user-1" }, error: null });
    expect(aliasFn).toHaveBeenCalledTimes(1);
    expect(aliasFn).toHaveBeenCalledWith({
      data: { user_id: "auth-user-1", visitor_id: "ph-visitor-1" },
    });
    expect(identify).toHaveBeenCalledWith("auth-user-1");
  });

  it("does not send the alias when sign-up errors", () => {
    noteSignUpIdentity({ user: null, error: new Error("taken") });
    expect(aliasFn).not.toHaveBeenCalled();
  });

  it("a thrown or rejected alias does not propagate", async () => {
    aliasFn.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => noteSignUpIdentity({ user: { id: "u2" }, error: null })).not.toThrow();
    resetSignupAlias();
    aliasFn.mockReset().mockRejectedValue(new Error("down"));
    expect(() => noteSignUpIdentity({ user: { id: "u3" }, error: null })).not.toThrow();
    await Promise.resolve();
    expect(identify).toHaveBeenCalledWith("u3");
  });

  it("server alias sends $create_alias with the salted hash and never throws", async () => {
    process.env["TELEMETRY_SALT"] = "test-salt";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await aliasAnonymousVisitor("ph-visitor-1", "auth-user-1")).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.event).toBe("$create_alias");
    expect(body.distinct_id).toBe("auth-user-1");
    expect(body.properties.alias).toMatch(/^[0-9a-f]{64}$/);
    expect(body.properties.alias).not.toContain("ph-visitor-1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    await expect(aliasAnonymousVisitor("ph-visitor-1", "auth-user-1")).resolves.toBe(false);
  });
});
