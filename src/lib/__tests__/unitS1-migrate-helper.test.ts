import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sourceList = vi.fn();
const targetList = vi.fn();
const getBucket = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: { from: () => ({ list: sourceList, download: vi.fn() }) },
    auth: { admin: { listUsers: vi.fn() } },
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      getBucket,
      createBucket: vi.fn(),
      from: () => ({ list: targetList, upload: vi.fn() }),
    },
    from: vi.fn(),
  }),
}));

import { computeActorHash } from "@/lib/telemetry.server";
import { bridgeHashes, handleMigrateS1 } from "@/routes/api/public/hooks/migrate-s1";

function req(body: unknown, secret?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers["x-migration-secret"] = secret;
  return new Request("http://x/api/public/hooks/migrate-s1", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const saved = { ...process.env };
beforeEach(() => {
  process.env["MIGRATION_HELPER_SECRET"] = "s3cret";
  process.env["NEW_SUPABASE_URL"] = "https://target.example";
  process.env["NEW_SUPABASE_SECRET_KEY"] = "k";
  delete process.env["NEW_TELEMETRY_SALT"];
});
afterEach(() => {
  process.env = { ...saved };
  vi.clearAllMocks();
});

describe("migrate-s1 gate", () => {
  it("401 on missing secret", async () => {
    expect((await handleMigrateS1(req({ action: "bridge" }))).status).toBe(401);
  });
  it("401 on wrong secret", async () => {
    expect((await handleMigrateS1(req({ action: "bridge" }, "nope"))).status).toBe(401);
  });
  it("500 when MIGRATION_HELPER_SECRET unset", async () => {
    delete process.env["MIGRATION_HELPER_SECRET"];
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await handleMigrateS1(req({ action: "bridge" }, "s3cret"))).status).toBe(500);
    expect(err).toHaveBeenCalled();
  });
});

describe("bridge", () => {
  it("400 when NEW_TELEMETRY_SALT unset", async () => {
    const res = await handleMigrateS1(req({ action: "bridge" }, "s3cret"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bridge not configured");
  });
  it("hashes match telemetry.server scheme", async () => {
    process.env["TELEMETRY_SALT"] = "old-salt";
    const uid = "11111111-2222-3333-4444-555555555555";
    const h = await bridgeHashes("old-salt", "new-salt", uid);
    expect(h.old_hash).toBe(await computeActorHash(uid));
    expect(h.old_hash).toBe(createHash("sha256").update("old-salt" + uid).digest("hex"));
    expect(h.new_hash).toBe(createHash("sha256").update("new-salt" + uid).digest("hex"));
  });
});

describe("copy_storage dry_run", () => {
  it("returns counts and sample without writing", async () => {
    sourceList.mockResolvedValue({
      data: [
        { id: "1", name: "a.pdf", metadata: { size: 10 } },
        { id: "2", name: "b.pdf", metadata: { size: 20 } },
      ],
      error: null,
    });
    getBucket.mockResolvedValue({ data: {}, error: null });
    targetList.mockResolvedValue({ data: [{ id: "9", name: "a.pdf", metadata: { size: 10 } }], error: null });
    const res = await handleMigrateS1(req({ action: "copy_storage", dry_run: true }, "s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dry_run: true, total: 2, skipped: 1, remaining: 1, sample: ["b.pdf"] });
  });
});
