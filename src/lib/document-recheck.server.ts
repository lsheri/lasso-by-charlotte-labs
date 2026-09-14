import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { parseWatchConfig } from "@/lib/connector-watch-shared";
import {
  RECHECK_AT_KEY,
  RECHECK_BATCH,
  RECHECK_INTERVAL_MS,
  RECHECK_MODIFIED_KEY,
} from "@/lib/document-recheck-shared";

type Client = SupabaseClient<Database>;

type Meta = Record<string, unknown>;

function metaOf(raw: unknown): Meta {
  return raw && typeof raw === "object" ? ({ ...(raw as Meta) } as Meta) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

async function writeMeta(supabase: Client, id: string, meta: Meta, extra?: Meta) {
  const { error } = await supabase
    .from("work_items")
    .update({
      meta: meta as Database["public"]["Tables"]["work_items"]["Row"]["meta"],
      ...(extra ?? {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Whether this account allows already-imported documents to be re-read. */
async function recheckAllowed(supabase: Client, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from("connector_accounts")
    .select("status, watch_config")
    .eq("profile_id", profileId)
    .eq("toolkit", "googledrive")
    .maybeSingle();
  if (!data || data.status !== "connected") return false;
  return parseWatchConfig(data.watch_config).recheck_documents;
}

/**
 * One cheap pass over connected Drive documents. Most documents cost a single
 * metadata call and no download: bytes are fetched only when the source says
 * the file moved, and a version is written only when the content itself is
 * different. Debounced server-side, so the client can ask as often as it likes.
 */
export async function recheckConnectedDocuments(
  supabase: Client,
  args: { profileId: string; userId: string },
): Promise<{ checked: number; changed: number; skipped: number }> {
  if (!(await recheckAllowed(supabase, args.profileId))) {
    return { checked: 0, changed: 0, skipped: 0 };
  }

  const { data, error } = await supabase
    .from("work_items")
    .select("id, meta, content_ref, content_hash, captured_at")
    .eq("owner_id", args.profileId)
    .eq("source", "connector:googledrive")
    .eq("type", "document")
    .not("meta->>drive_file_id", "is", null)
    .order("meta->>recheck_checked_at", { ascending: true, nullsFirst: true })
    .limit(RECHECK_BATCH);
  if (error) throw new Error(error.message);

  const cutoff = Date.now() - RECHECK_INTERVAL_MS;
  let checked = 0;
  let changed = 0;
  let skipped = 0;

  const { driveFileTimes, fetchDriveFileBytes } = await import("@/lib/composio.server");
  const { sha256Bytes, storeFile, recordNewVersion } = await import(
    "@/lib/connector-import.server"
  );

  for (const row of data ?? []) {
    const meta = metaOf(row.meta);
    const fileId = str(meta["drive_file_id"]);
    if (!fileId) continue;

    const lastAt = str(meta[RECHECK_AT_KEY]);
    const lastMs = lastAt ? Date.parse(lastAt) : 0;
    if (Number.isFinite(lastMs) && lastMs > cutoff) {
      skipped += 1;
      continue;
    }

    try {
      const times = await driveFileTimes(args.profileId, fileId);
      checked += 1;
      const nowIso = new Date().toISOString();
      const storedModified = str(meta[RECHECK_MODIFIED_KEY]);

      // Nothing moved at the source: state only, no bytes.
      if (!times.modifiedTime || times.modifiedTime === storedModified) {
        await writeMeta(supabase, row.id, { ...meta, [RECHECK_AT_KEY]: nowIso });
        continue;
      }

      const file = await fetchDriveFileBytes(args.profileId, fileId, null);
      if (!file) {
        await writeMeta(supabase, row.id, { ...meta, [RECHECK_AT_KEY]: nowIso });
        continue;
      }

      const hash = await sha256Bytes(file.bytes);
      const nextMeta: Meta = {
        ...meta,
        [RECHECK_AT_KEY]: nowIso,
        [RECHECK_MODIFIED_KEY]: times.modifiedTime,
      };

      // Touched but identical: the version chain stays quiet.
      if (hash === row.content_hash) {
        await writeMeta(supabase, row.id, nextMeta);
        continue;
      }

      const path = await storeFile(args.userId, file.name, file.bytes, file.mimeType);
      await recordNewVersion(supabase, {
        workItemId: row.id,
        previousRef: row.content_ref,
        previousHash: row.content_hash,
        previousAt: row.captured_at,
        newRef: path,
        newHash: hash,
        sourceEvent: "scheduled_recheck",
      });
      await writeMeta(supabase, row.id, nextMeta, { content_ref: path, content_hash: hash });
      changed += 1;
    } catch (error) {
      const { reportConnectorError } = await import("@/lib/connector-error.server");
      await reportConnectorError(supabase, { provider: "googledrive", error });
      // State is left untouched so this document is retried next pass.
    }
  }

  return { checked, changed, skipped };
}
