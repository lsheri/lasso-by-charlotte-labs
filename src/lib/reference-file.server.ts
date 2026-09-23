/**
 * P1b / C2. The one completion path for a file placeholder. The drop path and
 * the Drive path both land here after their own first checks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import { resolveProfile } from "@/lib/profile-resolve";
import { driveReferenceMatch, type ReferenceMatch, type ReferenceVia } from "@/lib/reference-file-shared";

export type CompleteReferenceAnswer =
  | { status: "done"; matched: ReferenceMatch }
  | { status: "refused"; reason: string };

type Row = { id: string; owner_id: string; org_id: string; source_meta: Json | null };
type Profile = { id: string; org_id: string };

/** Bytes to attach. The drop path reads them back from storage; Drive fetches and stores them first. */
export type ReferenceBytes =
  | { kind: "stored"; path: string }
  | {
      kind: "fetch";
      load: () => Promise<{
        path: string;
        bytes: Uint8Array;
        mimeType: string;
        exported: boolean;
        extraSourceMeta: Record<string, unknown>;
      } | null>;
    };

export async function completeReference(
  supabase: SupabaseClient<Database>,
  userId: string,
  args: {
    work_item_id: string;
    via: ReferenceVia;
    mime_type: string;
    bytes: ReferenceBytes;
    /** Runs after the owner and reference checks, before any fetch. */
    guard?: <T>(profile: Profile, run: () => Promise<T>) => Promise<T>;
  },
): Promise<CompleteReferenceAnswer> {
  const profile = await resolveProfile(supabase, userId);
  if (!profile) return { status: "refused", reason: "profile" };

  const { data: row } = await supabase
    .from("work_items")
    .select("id, owner_id, org_id, content_fidelity, source_meta")
    .eq("id", args.work_item_id)
    .maybeSingle();
  if (!row || row.owner_id !== profile.id) return { status: "refused", reason: "owner" };
  if (row.content_fidelity !== "reference") return { status: "refused", reason: "not_reference" };

  const run = () => finish(supabase, userId, profile, row as Row, args);
  return args.guard ? args.guard(profile, run) : run();
}

async function finish(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: Profile,
  row: Row,
  args: { via: ReferenceVia; mime_type: string; bytes: ReferenceBytes },
): Promise<CompleteReferenceAnswer> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let path: string;
  let bytes: Uint8Array;
  let mimeType = args.mime_type;
  let exported = false;
  let extraSourceMeta: Record<string, unknown> = {};
  if (args.bytes.kind === "stored") {
    path = args.bytes.path;
    const download = await supabaseAdmin.storage.from("work-files").download(path);
    if (download.error || !download.data) return { status: "refused", reason: "bytes" };
    bytes = new Uint8Array(await download.data.arrayBuffer());
  } else {
    const loaded = await args.bytes.load();
    if (!loaded) return { status: "refused", reason: "bytes" };
    ({ path, bytes, exported, extraSourceMeta } = loaded);
    mimeType = loaded.mimeType;
  }

  const { sha256Bytes } = await import("@/lib/connector-import.server");
  const hash = await sha256Bytes(bytes);

  const meta = (row.source_meta ?? {}) as Record<string, unknown>;
  const matched = driveReferenceMatch(
    typeof meta["sha256"] === "string" ? meta["sha256"] : null,
    hash,
    exported,
  );
  const nextMeta = {
    ...meta,
    ...extraSourceMeta,
    added_via: args.via,
    match: matched,
    ...(mimeType && !meta["mime_type"] ? { mime_type: mimeType } : {}),
  };

  const updated = await supabaseAdmin
    .from("work_items")
    .update({
      content_ref: path,
      content_hash: hash,
      content_fidelity: "verbatim",
      source_meta: nextMeta as unknown as Json,
    })
    .eq("id", row.id)
    .eq("content_fidelity", "reference")
    .select("id")
    .maybeSingle();
  if (updated.error || !updated.data) return { status: "refused", reason: "update" };

  await supabaseAdmin.from("document_versions").insert({
    work_item_id: row.id,
    version_no: 1,
    content_ref: path,
    content_hash: hash,
    parent_version_id: null,
    source_event: "reference_completed",
  });

  const { recordEvent } = await import("@/lib/telemetry.server");
  await recordEvent(supabase, {
    eventType: "workboard.reference_file_added",
    orgId: profile.org_id,
    userId,
    profileId: profile.id,
    dims: { matched, via: args.via },
  });
  return { status: "done", matched };
}
