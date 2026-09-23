/**
 * P1b item 2. Completes a file placeholder the chat created. The browser has
 * already put the bytes in the caller's own storage folder through the normal
 * upload path; this reads them back, hashes them on the server, and attaches
 * them to the existing row instead of creating a new one.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { resolveProfile } from "@/lib/profile-resolve";
import { referenceMatch, type ReferenceMatch } from "@/lib/reference-file-shared";

export type CompleteReferenceAnswer =
  | { status: "done"; matched: ReferenceMatch }
  | { status: "refused"; reason: string };

export const completeReferenceFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; path: string; via: string; mime_type?: string }) => ({
    work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
    path: typeof input?.path === "string" ? input.path : "",
    via: input?.via === "drive" ? ("drive" as const) : ("drop" as const),
    mime_type: typeof input?.mime_type === "string" ? input.mime_type : "",
  }))
  .handler(async ({ data, context }): Promise<CompleteReferenceAnswer> => {
    if (!data.work_item_id || !data.path) return { status: "refused", reason: "missing" };
    // The bytes must sit in the caller's own folder.
    if (!data.path.startsWith(`${context.userId}/`)) return { status: "refused", reason: "path" };
    const profile = await resolveProfile(context.supabase, context.userId);
    if (!profile) return { status: "refused", reason: "profile" };

    const { data: row } = await context.supabase
      .from("work_items")
      .select("id, owner_id, org_id, content_fidelity, source_meta")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (!row || row.owner_id !== profile.id) return { status: "refused", reason: "owner" };
    if (row.content_fidelity !== "reference") return { status: "refused", reason: "not_reference" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const download = await supabaseAdmin.storage.from("work-files").download(data.path);
    if (download.error || !download.data) return { status: "refused", reason: "bytes" };
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const { sha256Bytes } = await import("@/lib/connector-import.server");
    const hash = await sha256Bytes(bytes);

    const meta = (row.source_meta ?? {}) as Record<string, unknown>;
    const matched = referenceMatch(typeof meta["sha256"] === "string" ? meta["sha256"] : null, hash);
    const nextMeta = {
      ...meta,
      added_via: data.via,
      match: matched,
      ...(data.mime_type && !meta["mime_type"] ? { mime_type: data.mime_type } : {}),
    };

    const updated = await supabaseAdmin
      .from("work_items")
      .update({
        content_ref: data.path,
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
      content_ref: data.path,
      content_hash: hash,
      parent_version_id: null,
      source_event: "reference_completed",
    });

    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "workboard.reference_file_added",
      orgId: profile.org_id,
      userId: context.userId,
      profileId: profile.id,
      dims: { matched, via: data.via },
    });
    return { status: "done", matched };
  });
