/**
 * TEMPORARY. One-time migration helper for the move to our own Supabase project.
 * This route will be deleted after the migration completes. Do not build on it.
 *
 * POST /api/public/hooks/migrate-s1
 * Gate: header x-migration-secret must equal env MIGRATION_HELPER_SECRET (constant time).
 * Actions: copy_storage (work-files bucket, resumable) and bridge (actor hash bridge rows).
 * Responses carry counts only. No hash, salt or user id is ever returned or logged.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { sha256Hex } from "@/lib/telemetry.server";

const BUCKET = "work-files";
const DEFAULT_LIMIT = 50;

const BodySchema = z.object({
  action: z.enum(["copy_storage", "bridge"]),
  dry_run: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Constant-time string comparison over UTF-8 bytes. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  const len = Math.max(ea.length, eb.length);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** Same scheme as computeActorHash in telemetry.server.ts: sha256Hex(salt + userId). */
export async function bridgeHashes(oldSalt: string, newSalt: string, userId: string) {
  return {
    old_hash: await sha256Hex(oldSalt + userId),
    new_hash: await sha256Hex(newSalt + userId),
  };
}

type ObjInfo = { path: string; size: number };

async function listAll(client: SupabaseClient, prefix = ""): Promise<ObjInfo[]> {
  const out: ObjInfo[] = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list failed: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const path = prefix ? `${prefix}/${row.name}` : row.name;
      if (row.id === null || row.id === undefined) {
        out.push(...(await listAll(client, path)));
      } else {
        const size = Number((row.metadata as { size?: number } | null)?.size ?? -1);
        out.push({ path, size });
      }
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function targetClient(): SupabaseClient | null {
  const url = process.env["NEW_SUPABASE_URL"];
  const key = process.env["NEW_SUPABASE_SECRET_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function copyStorage(dryRun: boolean, limit: number): Promise<Response> {
  const target = targetClient();
  if (!target) return json({ error: "target not configured" }, 500);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const source = supabaseAdmin as unknown as SupabaseClient;

  const all = await listAll(source);
  const total = all.length;

  const { error: bucketErr } = await target.storage.getBucket(BUCKET);
  const bucketExists = !bucketErr;
  const existing = new Map<string, number>();
  if (bucketExists) for (const o of await listAll(target)) existing.set(o.path, o.size);

  const pending = all.filter((o) => existing.get(o.path) !== o.size);
  const alreadyThere = total - pending.length;

  if (dryRun) {
    return json({
      dry_run: true,
      total,
      skipped: alreadyThere,
      remaining: pending.length,
      sample: pending.slice(0, 5).map((o) => o.path),
    });
  }

  if (!bucketExists) {
    const { error } = await target.storage.createBucket(BUCKET, { public: false });
    if (error) return json({ error: "could not create target bucket" }, 500);
  }

  let copied = 0;
  let failed = 0;
  for (const obj of pending.slice(0, limit)) {
    const { data: blob, error: dlErr } = await source.storage.from(BUCKET).download(obj.path);
    if (dlErr || !blob) {
      failed++;
      continue;
    }
    const { error: upErr } = await target.storage
      .from(BUCKET)
      .upload(obj.path, blob, blob.type ? { upsert: true, contentType: blob.type } : { upsert: true });
    if (upErr) failed++;
    else copied++;
  }
  console.log(`[migrate-s1] copy_storage copied=${copied} failed=${failed} total=${total}`);
  return json({
    copied,
    skipped: alreadyThere,
    failed,
    remaining: pending.length - copied,
    total,
  });
}

async function bridge(dryRun: boolean): Promise<Response> {
  const newSalt = process.env["NEW_TELEMETRY_SALT"];
  if (!newSalt) return json({ error: "bridge not configured" }, 400);
  const oldSalt = process.env["TELEMETRY_SALT"];
  if (!oldSalt) return json({ error: "TELEMETRY_SALT unset" }, 500);
  const target = targetClient();
  if (!target) return json({ error: "target not configured" }, 500);

  const { error: probeErr } = await target
    .from("actor_hash_bridge")
    .select("old_hash", { head: true, count: "exact" })
    .limit(1);
  if (probeErr) {
    console.error("[migrate-s1] bridge: actor_hash_bridge table missing in target");
    return json({ error: "actor_hash_bridge table missing in target" }, 500);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids: string[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return json({ error: "could not list users" }, 500);
    const users = data?.users ?? [];
    for (const u of users) ids.push(u.id);
    if (users.length < perPage) break;
  }

  if (dryRun) return json({ dry_run: true, rows: ids.length });

  let inserted = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await Promise.all(ids.slice(i, i + 500).map((id) => bridgeHashes(oldSalt, newSalt, id)));
    const { error } = await target.from("actor_hash_bridge").insert(rows);
    if (error) {
      console.error(`[migrate-s1] bridge insert failed after ${inserted} rows`);
      return json({ error: "insert failed", inserted }, 500);
    }
    inserted += rows.length;
  }
  console.log(`[migrate-s1] bridge inserted=${inserted}`);
  return json({ inserted, total: ids.length });
}

export async function handleMigrateS1(request: Request): Promise<Response> {
  const secret = process.env["MIGRATION_HELPER_SECRET"];
  if (!secret) {
    console.error("[migrate-s1] MIGRATION_HELPER_SECRET is not set; refusing request");
    return json({ error: "helper not configured" }, 500);
  }
  const given = request.headers.get("x-migration-secret");
  if (!given || !safeEqual(given, secret)) return json({ error: "unauthorized" }, 401);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  try {
    if (body.action === "copy_storage") return await copyStorage(!!body.dry_run, body.limit ?? DEFAULT_LIMIT);
    return await bridge(!!body.dry_run);
  } catch (e) {
    console.error(`[migrate-s1] ${body.action} failed: ${(e as Error).message}`);
    return json({ error: "internal error" }, 500);
  }
}

export const Route = createFileRoute("/api/public/hooks/migrate-s1")({
  server: { handlers: { POST: async ({ request }) => handleMigrateS1(request) } },
});
