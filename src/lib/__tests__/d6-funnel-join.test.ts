// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserts = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const identify = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      },
    }),
  },
}));
vi.mock("posthog-js", () => ({
  default: { init: vi.fn(), identify, reset: vi.fn(), capture: vi.fn(), get_distinct_id: vi.fn() },
}));

import { recordAnonymousEvent } from "@/lib/telemetry.server";
import { noteSignUpIdentity } from "@/routes/auth";

beforeEach(() => {
  process.env["TELEMETRY_SALT"] = "test-salt";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
});
afterEach(() => {
  inserts.length = 0;
  identify.mockClear();
  vi.unstubAllGlobals();
});

describe("Unit D6: stable visitor id", () => {
  it("uses the visitor id when present, so two page loads are one visitor", async () => {
    await recordAnonymousEvent("plans.viewed", "view-a", { src: "front_door" }, "ph-visitor-1");
    await recordAnonymousEvent("signup.started", "view-b", { intent: "company", src: "front_door" }, "ph-visitor-1");
    expect(inserts).toHaveLength(2);
    expect(inserts[0]!["actor_hash"]).toBeTruthy();
    expect(inserts[0]!["actor_hash"]).toBe(inserts[1]!["actor_hash"]);
  });

  it("still writes a valid event with a per-view id when the visitor id is missing", async () => {
    await recordAnonymousEvent("plans.viewed", "view-a", { src: "direct" });
    await recordAnonymousEvent("plans.viewed", "view-b", { src: "direct" });
    expect(inserts).toHaveLength(2);
    expect(inserts[0]!["event_type"]).toBe("plans.viewed");
    expect(inserts[0]!["workspace_type"]).toBe("none");
    expect(typeof inserts[0]!["actor_hash"]).toBe("string");
    expect(inserts[0]!["actor_hash"]).not.toBe(inserts[1]!["actor_hash"]);
  });
});

describe("Unit D6: identify at sign-up", () => {
  it("identifies by the auth user id on a successful sign-up", () => {
    noteSignUpIdentity({ user: { id: "auth-user-1" }, error: null });
    expect(identify).toHaveBeenCalledWith("auth-user-1");
  });

  it("does not identify on a failed sign-up", () => {
    noteSignUpIdentity({ user: null, error: new Error("taken") });
    noteSignUpIdentity({ user: { id: "auth-user-1" }, error: new Error("taken") });
    expect(identify).not.toHaveBeenCalled();
  });
});
