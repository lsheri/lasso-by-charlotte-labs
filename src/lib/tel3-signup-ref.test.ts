import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { withSignupRef } from "@/lib/telemetry.server";
import { guardEventDims } from "@/lib/event-dim-allowlist";

describe("TEL-3 signup_ref on org.created", () => {
  const prev = process.env["TELEMETRY_SALT"];
  beforeEach(() => { process.env["TELEMETRY_SALT"] = "salt-x"; });
  afterEach(() => { process.env["TELEMETRY_SALT"] = prev; });

  it("stamps the hashed visitor on org.created only, never the raw id", async () => {
    const base = guardEventDims("org.created", { org_type: "firm", register: "none", entry_door: "chooser" }).dims;
    const dims = await withSignupRef("org.created", base, "v-123");
    const expected = createHash("sha256").update("salt-x" + "anon:v-123").digest("hex");
    expect(dims["signup_ref"]).toBe(expected);
    expect(JSON.stringify(dims)).not.toContain("v-123");

    const other = await withSignupRef("home.opened", {}, "v-123");
    expect(other).not.toHaveProperty("signup_ref");
    expect(JSON.stringify(other)).not.toContain("v-123");
  });

  it("allowlist keeps signup_ref on org.created", () => {
    expect(guardEventDims("org.created", { org_type: "firm", signup_ref: "h", junk: "j" }).dims).toEqual({ org_type: "firm", signup_ref: "h" });
  });
});
