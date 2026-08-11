import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PickerPage } from "@/lib/connector-picker-shared";
import { isBrowsableToolkit, type BrowsableToolkit } from "@/lib/connector-toolkits";

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

type ToolkitBrowseInput = BrowseInput & { toolkit: BrowsableToolkit };
type ToolkitImportInput = ImportInput & { toolkit: BrowsableToolkit };

function validateBrowse(input: BrowseInput | undefined): BrowseInput {
  return input ?? {};
}

function validateImport(input: ImportInput): ImportInput {
  if (!input || !Array.isArray(input.ids) || input.ids.length === 0) {
    throw new Error("Select at least one item first.");
  }
  return { profile_id: input.profile_id, ids: input.ids.slice(0, 100) };
}

function validateToolkitBrowse(input: ToolkitBrowseInput | undefined): ToolkitBrowseInput {
  if (!input || !isBrowsableToolkit(input.toolkit)) throw new Error("Unsupported connector");
  return { ...validateBrowse(input), toolkit: input.toolkit };
}

function validateToolkitImport(input: ToolkitImportInput): ToolkitImportInput {
  if (!input || !isBrowsableToolkit(input.toolkit)) throw new Error("Unsupported connector");
  return { ...validateImport(input), toolkit: input.toolkit };
}

/** Folder-first listing for every browsable file connector. */
export const browseConnectorItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateToolkitBrowse)
  .handler(async ({ data, context }): Promise<PickerPage> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected, importedToolkitIds } = await import("@/lib/connector-import.server");
    const { browseConnector } = await import("@/lib/connector-browse.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, data.toolkit);

    const seen = await importedToolkitIds(supabase, profile.id, data.toolkit);
    return browseConnector(supabase, {
      toolkit: data.toolkit,
      profileId: profile.id,
      folderId: data.folder_id ?? null,
      search: data.search ?? null,
      pageToken: data.page_token ?? null,
      seen,
    });
  });

/** Import exactly what the user ticked — never anything else. */
export const importConnectorItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateToolkitImport)
  .handler(async ({ data, context }): Promise<{ imported: number; skipped: number }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected } = await import("@/lib/connector-import.server");
    const { importConnectorFiles } = await import("@/lib/connector-browse.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, data.toolkit);

    return importConnectorFiles(supabase, {
      toolkit: data.toolkit,
      profileId: profile.id,
      orgId: profile.org_id,
      userId,
      ids: data.ids,
    });
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
    if (!tool || meetings.length === 0) {
      return {
        items: [],
        nextPageToken: null,
        unsupported:
          "Granola is connected but meeting browsing isn't available yet — this connection doesn't return a meeting list. Paste or upload still works.",
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
    const { requireConnected, importedGranolaIds, storeFile, captureEvents } =
      await import("@/lib/connector-import.server");
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
