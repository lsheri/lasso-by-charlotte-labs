import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), host: "" as string | undefined }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => mocks.host }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "p@example.test" } }, error: null }) } },
    from: () => ({
      insert: mocks.insert,
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));
vi.mock("../org-type.server", () => ({
  workspaceStamp: async () => ({ workspace_type: "company", affiliated: false }),
  accountStageOf: async () => null,
}));
vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));

import { recordAnonymousEvent, recordEvent, resetConsentCache } from "../telemetry.server";

function sb(tier: string) {
  return {
    from: (table: string) =>
      table === "data_consent_state"
        ? { select: () => ({ eq: async () => ({ data: [{ scope: "org", tier, ledger_version: 1, profile_id: null }] }) }) }
        : { insert: mocks.insert },
  } as never;
}

function lastRow(): Record<string, unknown> {
  return mocks.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

/**
 * AUDIT-1 (7 Nov 2026), A2 F10 and F7. The server write path now runs the
 * allowlist over the whole union, and an "unknown" environment says which
 * kind of host produced it, as a bucket.
 */
describe("AUDIT-1: recordEvent guards dims and explains an unknown environment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetConsentCache();
    process.env["TELEMETRY_SALT"] = "salt";
    mocks.insert.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
  });

  it("keeps listed dims and drops an unlisted key before the insert", async () => {
    mocks.host = "lasso.charlotte-labs.com";
    await recordEvent(sb("c"), {
      eventType: "reflect.message_sent",
      orgId: "org-1",
      userId: "user-1",
      dims: { context_share: "100", scope: "board", title: "never" },
    });
    const row = lastRow();
    expect(row["environment"]).toBe("production");
    expect(row["dims"]).toEqual({ context_share: "100", scope: "board" });
  });

  it("an unknown environment carries host_class, a bucket and never the host", async () => {
    mocks.host = "abc-123.lovableproject.com";
    await recordEvent(sb("c"), { eventType: "presence.active", orgId: "org-1", userId: "user-1", dims: { week_start: "2026-11-02" } });
    const row = lastRow();
    expect(row["environment"]).toBe("unknown");
    expect(row["dims"]).toEqual({ week_start: "2026-11-02", host_class: "lovable_project" });
    expect(JSON.stringify(row)).not.toContain("abc-123");
  });

  it("a known environment carries no host_class", async () => {
    mocks.host = "id-preview--x.lovable.app";
    await recordEvent(sb("c"), { eventType: "presence.active", orgId: "org-1", userId: "user-1", dims: { week_start: "2026-11-02" } });
    expect(lastRow()["environment"]).toBe("preview");
    expect(lastRow()["dims"]).toEqual({ week_start: "2026-11-02" });
  });

  it("the anonymous path stamps the bucket the same way", async () => {
    mocks.host = undefined;
    await recordAnonymousEvent("landing.viewed", "view-1", { surface: "landing-board" });
    const row = lastRow();
    expect(row["environment"]).toBe("unknown");
    expect(row["dims"]).toEqual({ surface: "landing-board", host_class: "none" });
  });
});
