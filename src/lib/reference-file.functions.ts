/**
 * P1b item 2. Completes a file placeholder the chat created. The browser has
 * already put the bytes in the caller's own storage folder through the normal
 * upload path; this reads them back, hashes them on the server, and attaches
 * them to the existing row instead of creating a new one.
 *
 * C2: the same completion can take a file the person chose in Google Drive.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompleteReferenceAnswer } from "@/lib/reference-file.server";

export type { CompleteReferenceAnswer };

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
    const { completeReference } = await import("@/lib/reference-file.server");
    return completeReference(context.supabase, context.userId, {
      work_item_id: data.work_item_id,
      via: data.via,
      mime_type: data.mime_type,
      bytes: { kind: "stored", path: data.path },
    });
  });

export const completeReferenceFromDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; drive_file_id: string; mime_type?: string }) => ({
    work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
    drive_file_id: typeof input?.drive_file_id === "string" ? input.drive_file_id : "",
    mime_type: typeof input?.mime_type === "string" ? input.mime_type : "",
  }))
  .handler(async ({ data, context }): Promise<CompleteReferenceAnswer> => {
    if (!data.work_item_id || !data.drive_file_id) return { status: "refused", reason: "missing" };
    const { supabase, userId } = context;
    const { completeReference } = await import("@/lib/reference-file.server");
    const { guardConnector } = await import("@/lib/connector-error.server");
    const { requireConnected, storeFile } = await import("@/lib/connector-import.server");
    const { isGoogleNative, placeholderExportTarget } = await import("@/lib/reference-file-shared");

    return completeReference(supabase, userId, {
      work_item_id: data.work_item_id,
      via: "drive",
      mime_type: data.mime_type,
      guard: (profile, run) =>
        guardConnector(supabase, { provider: "googledrive", orgId: profile.org_id, userId }, async () => {
          await requireConnected(supabase, profile.id, "googledrive");
          return run();
        }),
      bytes: {
        kind: "fetch",
        load: async () => {
          const { fetchDriveFileBytes } = await import("@/lib/composio.server");
          const { resolveProfile } = await import("@/lib/profile-resolve");
          const profile = await resolveProfile(supabase, userId);
          if (!profile) return null;
          const file = await fetchDriveFileBytes(
            profile.id,
            data.drive_file_id,
            data.mime_type || null,
            (native) => [placeholderExportTarget(native)],
          );
          if (!file) return null;
          const path = await storeFile(userId, file.name, file.bytes, file.mimeType);
          return {
            path,
            bytes: file.bytes,
            mimeType: file.mimeType,
            // Any Google-native source, exported or rendered, can't match the chat's bytes.
            exported: isGoogleNative(file.sourceMime ?? data.mime_type),
            // Provenance only. meta.drive_file_id stays unset so Open larger keeps the stored file.
            extraSourceMeta: { drive_file_id: data.drive_file_id },
          };
        },
      },
    });
  });
