import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PickerPage } from "@/lib/connector-picker-shared";
import { isBrowsableToolkit, type BrowsableToolkit } from "@/lib/connector-toolkits";

type BrowseInput = {
  profile_id?: string | undefined;
  folder_id?: string | undefined;
  folder_name?: string | undefined;
  search?: string | undefined;
  page_token?: string | undefined;
};

type ImportInput = {
  profile_id?: string | undefined;
  ids: string[];
  folder_name?: string | undefined;
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
  return {
    profile_id: input.profile_id,
    ids: input.ids.slice(0, 100),
    folder_name: input.folder_name,
  };
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
    const { watchedFolderIds } = await import("@/lib/connector-watch.server");
    const watched = await watchedFolderIds(supabase, profile.id, data.toolkit);
    return browseConnector(supabase, {
      toolkit: data.toolkit,
      profileId: profile.id,
      folderId: data.folder_id ?? null,
      folderName: data.folder_name ?? null,
      search: data.search ?? null,
      pageToken: data.page_token ?? null,
      seen,
      watched,
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
      folderName: data.folder_name ?? null,
    });
  });

export const browseGranolaMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBrowse)
  .handler(async ({ data, context }): Promise<PickerPage> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { importedGranolaIds } = await import("@/lib/connector-import.server");
    const { requireGranolaKey, listGranolaNotes } = await import("@/lib/granola.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const key = await requireGranolaKey(profile.id);
    const { notes, cursor } = await listGranolaNotes(key, {
      limit: 30,
      cursor: data.page_token ?? null,
    });
    const seen = await importedGranolaIds(supabase, profile.id);
    const term = data.search?.trim().toLowerCase();

    return {
      items: notes
        .filter((note) => !term || note.title.toLowerCase().includes(term))
        .map((note) => ({
          id: note.id,
          title: note.title,
          subtitle: null,
          date: note.date,
          isFolder: false,
          alreadyInLasso: seen.has(note.id),
        })),
      nextPageToken: cursor,
      unsupported:
        notes.length === 0 && !data.page_token
          ? "No meeting notes came back yet. Granola only returns notes that already have an AI summary."
          : null,
    };
  });

export const importGranolaMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateImport)
  .handler(async ({ data, context }): Promise<{ imported: number; skipped: number }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { importedGranolaIds, storeFile, captureEvents } =
      await import("@/lib/connector-import.server");
    const { requireGranolaKey, fetchGranolaNote } = await import("@/lib/granola.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const key = await requireGranolaKey(profile.id);
    const seen = await importedGranolaIds(supabase, profile.id);
    let imported = 0;
    let skipped = 0;

    for (const [index, id] of data.ids.entries()) {
      if (seen.has(id)) {
        skipped += 1;
        continue;
      }
      // One note at a time, with a breath between calls: Granola rate-limits.
      if (index > 0) await new Promise((r) => setTimeout(r, 250));
      const note = await fetchGranolaNote(key, id);
      if (!note) {
        skipped += 1;
        continue;
      }
      const bytes = new TextEncoder().encode(note.markdown);
      const path = await storeFile(
        userId,
        `${note.title}.md`,
        bytes,
        "text/markdown; charset=utf-8",
      );
      const insert = await supabase.from("work_items").insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type: "call",
        source: "connector:granola",
        source_vendor: "granola",
        title: note.title,
        visibility: "unmapped",
        content_ref: path,
        content_fidelity: "transcribed",
        ts_precision: note.date ? "source" : "capture",
        created_at_source: note.date,
        source_meta: { filename: `${note.title}.md`, mime_type: "text/markdown" },
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

/** Gmail: label chips stand in for folders, plus Gmail query syntax passthrough. */
export const browseGmailThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBrowse)
  .handler(async ({ data, context }): Promise<PickerPage> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected, importedGmailThreadIds } =
      await import("@/lib/connector-import.server");
    const { listGmailLabels, listGmailThreads } = await import("@/lib/gmail.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, "gmail");

    const labels = await listGmailLabels(profile.id);
    const scope = data.folder_id ?? "in:inbox";
    const term = data.search?.trim();
    const query = [scope, term].filter(Boolean).join(" ");

    const { threads, nextPageToken } = await listGmailThreads(profile.id, {
      query,
      pageToken: data.page_token ?? null,
    });
    const seen = await importedGmailThreadIds(supabase, profile.id);

    return {
      items: threads.map((thread) => ({
        id: thread.id,
        title: thread.subject,
        subtitle: [thread.participants, thread.snippet].filter(Boolean).join(" — ") || null,
        date: thread.date,
        isFolder: false,
        alreadyInLasso: seen.has(thread.id),
        hint: null,
      })),
      nextPageToken,
      unsupported:
        threads.length === 0 && !data.page_token ? "No threads matched that view." : null,
      labels,
    };
  });

export const importGmailThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateImport)
  .handler(async ({ data, context }): Promise<{ imported: number; skipped: number }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { requireConnected, importedGmailThreadIds, storeFile, captureEvents } =
      await import("@/lib/connector-import.server");
    const { fetchGmailThread } = await import("@/lib/gmail.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    await requireConnected(supabase, profile.id, "gmail");

    const seen = await importedGmailThreadIds(supabase, profile.id);
    let imported = 0;
    let skipped = 0;

    for (const [index, id] of data.ids.entries()) {
      if (seen.has(id)) {
        skipped += 1;
        continue;
      }
      if (index > 0) await new Promise((r) => setTimeout(r, 200));
      const thread = await fetchGmailThread(profile.id, id);
      if (!thread) {
        skipped += 1;
        continue;
      }
      const bytes = new TextEncoder().encode(thread.markdown);
      const path = await storeFile(
        userId,
        `${thread.subject}.md`,
        bytes,
        "text/markdown; charset=utf-8",
      );
      const insert = await supabase.from("work_items").insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type: "email",
        source: "connector:gmail",
        source_vendor: "gmail",
        title: thread.subject,
        visibility: "unmapped",
        content_ref: path,
        content_fidelity: "verbatim",
        ts_precision: thread.date ? "source" : "capture",
        created_at_source: thread.date,
        source_meta: { filename: `${thread.subject}.md`, mime_type: "text/markdown" },
        meta: { gmail_thread_id: id },
      });
      if (insert.error) throw new Error(insert.error.message);
      seen.add(id);
      imported += 1;
    }

    await captureEvents(supabase, {
      orgId: profile.org_id,
      userId,
      toolkit: "gmail",
      source: "gmail",
      imported,
    });
    return { imported, skipped };
  });
