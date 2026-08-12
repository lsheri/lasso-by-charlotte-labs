import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  TOOLKIT_ID_KEY,
  TOOLKIT_SOURCE,
  type BrowsableToolkit,
  type ConnectorToolkit,
} from "@/lib/connector-toolkits";

type Client = SupabaseClient<Database>;

/** Guards every picker call: a live connection or a clear reconnect prompt. */
export async function requireConnected(
  supabase: Client,
  profileId: string,
  toolkit: ConnectorToolkit,
): Promise<void> {
  const { data } = await supabase
    .from("connector_accounts")
    .select("status")
    .eq("profile_id", profileId)
    .eq("toolkit", toolkit)
    .maybeSingle();
  if (data?.status !== "connected") {
    throw new Error("That connection has expired. Reconnect it on Where work lives.");
  }
}

async function importedIds(
  supabase: Client,
  profileId: string,
  source: string,
  key: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("work_items")
    .select("meta")
    .eq("owner_id", profileId)
    .eq("source", source);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const value = (row.meta as Record<string, unknown> | null)?.[key];
    if (typeof value === "string") seen.add(value);
  }
  return seen;
}

/** Provider file ids already in this profile's Work, for the "In Lasso" badge. */
export function importedToolkitIds(
  supabase: Client,
  profileId: string,
  toolkit: BrowsableToolkit,
): Promise<Set<string>> {
  return importedIds(supabase, profileId, TOOLKIT_SOURCE[toolkit], TOOLKIT_ID_KEY[toolkit]);
}

export function importedGranolaIds(supabase: Client, profileId: string): Promise<Set<string>> {
  return importedIds(supabase, profileId, "connector:granola", "granola_id");
}

export function importedGmailThreadIds(supabase: Client, profileId: string): Promise<Set<string>> {
  return importedIds(supabase, profileId, "connector:gmail", "gmail_thread_id");
}

export type ExistingItem = {
  id: string;
  content_ref: string | null;
  content_hash: string | null;
  captured_at: string;
};

/**
 * Provider file id to the work item that already holds it. Re-importing the
 * same file must land on the same work item, or every link pointing at it is
 * orphaned.
 */
export async function existingByProviderId(
  supabase: Client,
  profileId: string,
  source: string,
  key: string,
): Promise<Map<string, ExistingItem>> {
  const { data, error } = await supabase
    .from("work_items")
    .select("id, meta, content_ref, content_hash, captured_at")
    .eq("owner_id", profileId)
    .eq("source", source);
  if (error) throw new Error(error.message);
  const map = new Map<string, ExistingItem>();
  for (const row of data ?? []) {
    const value = (row.meta as Record<string, unknown> | null)?.[key];
    if (typeof value !== "string") continue;
    map.set(value, {
      id: row.id,
      content_ref: row.content_ref,
      content_hash: row.content_hash,
      captured_at: row.captured_at,
    });
  }
  return map;
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * A changed re-import keeps the work item and records a version. The first
 * re-import also backfills version 1 from whatever the item held, so the chain
 * always has a parent to point at.
 */
export async function recordNewVersion(
  supabase: Client,
  args: {
    workItemId: string;
    previousRef: string | null;
    previousHash: string | null;
    previousAt: string;
    newRef: string;
    newHash: string;
    sourceEvent: string;
  },
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("document_versions")
    .select("id, version_no")
    .eq("work_item_id", args.workItemId)
    .order("version_no", { ascending: false });
  if (error) throw new Error(error.message);

  let versions = rows ?? [];
  if (versions.length === 0 && args.previousRef) {
    const first = await supabase
      .from("document_versions")
      .insert({
        work_item_id: args.workItemId,
        version_no: 1,
        content_ref: args.previousRef,
        content_hash: args.previousHash ?? "",
        parent_version_id: null,
        source_event: "initial_capture",
        created_at: args.previousAt,
      })
      .select("id, version_no")
      .maybeSingle();
    if (first.error) throw new Error(first.error.message);
    if (first.data) versions = [first.data];
  }

  const parent = versions[0] ?? null;
  const nextNo = (parent?.version_no ?? 0) + 1;
  const inserted = await supabase.from("document_versions").insert({
    work_item_id: args.workItemId,
    version_no: nextNo,
    content_ref: args.newRef,
    content_hash: args.newHash,
    parent_version_id: parent?.id ?? null,
    source_event: args.sourceEvent,
  });
  if (inserted.error) throw new Error(inserted.error.message);
  return nextNo;
}

/** Connector bytes are written with the service role, so signed URLs are minted
 * server-side by getWorkFileUrl exactly as they are for MCP pushes. */
export async function storeFile(
  userId: string,
  filename: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
  const path = `${userId}/${crypto.randomUUID()}-${safe}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from("work-files")
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** One capture event per imported item, plus a single sync event per run. */
export async function captureEvents(
  supabase: Client,
  args: { orgId: string; userId: string; toolkit: string; source: string; imported: number },
): Promise<void> {
  const { recordEvent } = await import("./telemetry.server");
  for (let i = 0; i < args.imported; i += 1) {
    await recordEvent(supabase, {
      eventType: "workitem.captured",
      orgId: args.orgId,
      userId: args.userId,
      dims: { channel: "connector", source: args.source },
    });
  }
  await recordEvent(supabase, {
    eventType: "connector.synced",
    orgId: args.orgId,
    userId: args.userId,
    dims: { toolkit: args.toolkit, imported: args.imported },
  });
}
