import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PickerPage } from "@/lib/connector-picker-shared";

type BrowseInput = {
  profile_id?: string | undefined;
  folder_id?: string | undefined;
  search?: string | undefined;
  page_token?: string | undefined;
};

type ImportInput = {
  profile_id?: string | undefined;
  ids: string[];
};

function validateBrowse(input: BrowseInput | undefined): BrowseInput {
  return input ?? {};
}

function validateImport(input: ImportInput): ImportInput {
  if (!input || !Array.isArray(input.ids) || input.ids.length === 0) {
    throw new Error("Select at least one item first.");
  }
  return { profile_id: input.profile_id, ids: input.ids.slice(0, 100) };
}

export const browseDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBrowse)
  .handler(async ({ data, context }): Promise<PickerPage> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected, importedDriveIds } = await import("@/lib/connector-import.server");
    const { browseDrive, DRIVE_FOLDER_MIME } = await import("@/lib/composio.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, "googledrive");

    const page = await browseDrive(profile.id, {
      folderId: data.folder_id ?? null,
      search: data.search ?? null,
      pageToken: data.page_token ?? null,
    });
    const seen = await importedDriveIds(supabase, profile.id);

    return {
      items: page.files.map((file) => ({
        id: file.id ?? "",
        title: file.name ?? "Untitled",
        subtitle: file.mimeType ?? null,
        date: file.modifiedTime ?? null,
        isFolder: file.mimeType === DRIVE_FOLDER_MIME,
        alreadyInLasso: Boolean(file.id && seen.has(file.id)),
      })),
      nextPageToken: page.nextPageToken,
      unsupported: null,
    };
  });

export const importDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateImport)
  .handler(async ({ data, context }): Promise<{ imported: number; skipped: number }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected, importedDriveIds, storeFile, captureEvents } = await import(
      "@/lib/connector-import.server"
    );
    const { fetchDriveFileBytes } = await import("@/lib/composio.server");
    const { driveWorkType } = await import("@/lib/connector-toolkits");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, "googledrive");

    const seen = await importedDriveIds(supabase, profile.id);
    let imported = 0;
    let skipped = 0;

    for (const fileId of data.ids) {
      if (seen.has(fileId)) {
        skipped += 1;
        continue;
      }
      const file = await fetchDriveFileBytes(profile.id, fileId);
      if (!file) {
        skipped += 1;
        continue;
      }
      const meta = await supabase
        .from("work_items")
        .select("id")
        .eq("owner_id", profile.id)
        .limit(0);
      if (meta.error) throw new Error(meta.error.message);

      const name = file.name ?? "Untitled file";
      const path = await storeFile(userId, name, file.bytes, file.mimeType);
      const insert = await supabase.from("work_items").insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type: driveWorkType(file.mimeType),
        source: "connector:googledrive",
        source_vendor: "gdrive",
        title: name,
        visibility: "unmapped",
        content_ref: path,
        content_fidelity: "verbatim",
        ts_precision: "source",
        created_at_source: file.modifiedTime ?? null,
        source_meta: { filename: name, mime_type: file.mimeType },
        meta: {
          drive_file_id: fileId,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink ?? null,
        },
      });
      if (insert.error) throw new Error(insert.error.message);
      seen.add(fileId);
      imported += 1;
    }

    await captureEvents(supabase, {
      orgId: profile.org_id,
      userId,
      toolkit: "googledrive",
      source: "gdrive",
      imported,
    });
    return { imported, skipped };
  });

export const browseGranolaMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBrowse)
  .handler(async ({ data, context }): Promise<PickerPage> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected, importedGranolaIds } = await import("@/lib/connector-import.server");
    const { listGranolaMeetings } = await import("@/lib/composio.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, "granola_mcp");

    const { meetings, tool } = await listGranolaMeetings(profile.id);
    if (!tool) {
      return {
        items: [],
        nextPageToken: null,
        unsupported:
          "Granola is connected, but it isn't publishing a meeting list yet. Paste or upload still works.",
      };
    }
    const seen = await importedGranolaIds(supabase, profile.id);
    const term = data.search?.trim().toLowerCase();

    return {
      items: meetings
        .filter((m) => !term || m.title.toLowerCase().includes(term))
        .map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: null,
          date: m.date,
          isFolder: false,
          alreadyInLasso: seen.has(m.id),
        })),
      nextPageToken: null,
      unsupported: null,
    };
  });

export const importGranolaMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateImport)
  .handler(async ({ data, context }): Promise<{ imported: number; skipped: number }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected, importedGranolaIds, storeFile, captureEvents } = await import(
      "@/lib/connector-import.server"
    );
    const { listGranolaMeetings, fetchGranolaTranscript } = await import("@/lib/composio.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, "granola_mcp");

    const { meetings } = await listGranolaMeetings(profile.id);
    const seen = await importedGranolaIds(supabase, profile.id);
    let imported = 0;
    let skipped = 0;

    for (const id of data.ids) {
      if (seen.has(id)) {
        skipped += 1;
        continue;
      }
      const meeting = meetings.find((m) => m.id === id);
      const transcript = await fetchGranolaTranscript(profile.id, id);
      if (!transcript) {
        skipped += 1;
        continue;
      }
      const title = meeting?.title ?? "Untitled meeting";
      const bytes = new TextEncoder().encode(transcript);
      const path = await storeFile(userId, `${title}.md`, bytes, "text/markdown; charset=utf-8");
      const insert = await supabase.from("work_items").insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type: "call",
        source: "connector:granola",
        source_vendor: "granola",
        title,
        visibility: "unmapped",
        content_ref: path,
        content_fidelity: "transcribed",
        ts_precision: meeting?.date ? "source" : "capture",
        created_at_source: meeting?.date ?? null,
        source_meta: { filename: `${title}.md`, mime_type: "text/markdown" },
        meta: { granola_id: id },
      });
      if (insert.error) throw new Error(insert.error.message);
      seen.add(id);
      imported += 1;
    }

    await captureEvents(supabase, {
      orgId: profile.org_id,
      userId,
      toolkit: "granola_mcp",
      source: "granola",
      imported,
    });
    return { imported, skipped };
  });
