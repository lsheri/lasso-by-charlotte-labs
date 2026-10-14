import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserts = vi.hoisted(() => [] as Array<Record<string, unknown>>);

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

import { recordAnonymousEvent } from "@/lib/telemetry.server";

beforeEach(() => {
  process.env["TELEMETRY_SALT"] = "test-salt";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
});
afterEach(() => {
  inserts.length = 0;
  vi.unstubAllGlobals();
});

describe("TEL-1: no_org skip reason", () => {
  it("stamps egress_skipped_reason on anonymous rows and keeps workspace_type and dims", async () => {
    await recordAnonymousEvent("plans.viewed", "view-a", { src: "front_door" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!["egress_skipped_reason"]).toBe("no_org");
    expect(inserts[0]!["workspace_type"]).toBe("none");
    expect(inserts[0]!["dims"]).toEqual({ src: "front_door" });
  });
});
