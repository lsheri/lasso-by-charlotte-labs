import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { PickerPage } from "@/lib/connector-picker-shared";
import { looksLikeTranscript, transcriptHint } from "@/lib/transcript-detect";
import {
  driveWorkType,
  TOOLKIT_ID_KEY,
  TOOLKIT_SOURCE,
  TOOLKIT_VENDOR,
  type BrowsableToolkit,
} from "@/lib/connector-toolkits";

type Client = SupabaseClient<Database>;

/** Composio entity + connected account for the profile's connection. */
async function auth(supabase: Client, profileId: string, toolkit: BrowsableToolkit) {
  const { data } = await supabase
    .from("connector_accounts")
    .select("composio_account_id")
    .eq("profile_id", profileId)
    .eq("toolkit", toolkit)
    .maybeSingle();
  const accountId = data?.composio_account_id ?? "";
  if (!accountId) {
    throw new Error("That connection has expired. Reconnect it on Where work lives.");
  }
  return { entityId: profileId, accountId };
}

export async function browseConnector(
  supabase: Client,
  args: {
    toolkit: BrowsableToolkit;
    profileId: string;
    folderId: string | null;
    folderName: string | null;
    search: string | null;
    pageToken: string | null;
    seen: Set<string>;
    watched: Set<string>;
  },
): Promise<PickerPage> {
  if (args.toolkit === "googledrive") {
    const { browseDrive, DRIVE_FOLDER_MIME } = await import("@/lib/composio.server");
    const page = await browseDrive(args.profileId, {
      folderId: args.folderId,
      search: args.search,
      pageToken: args.pageToken,
    });
    return {
      items: page.files.map((file) => {
        const isFolder = file.mimeType === DRIVE_FOLDER_MIME;
        return {
          id: file.id ?? "",
          title: file.name ?? "Untitled",
          subtitle: file.mimeType ?? null,
          date: file.modifiedTime ?? null,
          isFolder,
          alreadyInLasso: Boolean(file.id && args.seen.has(file.id)),
          hint: isFolder ? null : transcriptHint(file.name, args.folderName),
          isWatched: isFolder ? args.watched.has(file.id ?? "") : false,
        };
      }),
      nextPageToken: page.nextPageToken,
      unsupported: null,
    };
  }

  const { browseMicrosoft } = await import("@/lib/microsoft.server");
  const items = await browseMicrosoft(
    args.toolkit,
    await auth(supabase, args.profileId, args.toolkit),
    { folderId: args.folderId, search: args.search },
  );
  return {
    items: items.map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: item.mimeType,
      date: item.modified,
      isFolder: item.isFolder,
      alreadyInLasso: args.seen.has(item.id),
      hint: item.isFolder ? null : transcriptHint(item.name, args.folderName),
      isWatched: item.isFolder ? args.watched.has(item.id) : false,
    })),
    nextPageToken: null,
    unsupported: null,
  };
}

/** The Drive names that usually hold call recordings and their transcripts. */
const TRANSCRIPT_TERMS = ["Meet Recordings", "Transcript", "Recording", "Notes by Gemini"];

/**
 * A Google Drive listing scoped to likely call transcripts: the "Meet
 * Recordings" folder first, then the existing title heuristics across the
 * Drive. Still picker-only, nothing is imported here.
 */
export async function browseDriveTranscripts(
  args: { profileId: string; search: string | null; seen: Set<string> },
): Promise<PickerPage> {
  const { browseDrive, DRIVE_FOLDER_MIME } = await import("@/lib/composio.server");

  type Raw = { id?: string; name?: string; mimeType?: string; modifiedTime?: string };
  const found = new Map<string, { raw: Raw; folder: string | null }>();

  if (args.search?.trim()) {
    const page = await browseDrive(args.profileId, { search: args.search });
    for (const file of page.files as Raw[]) {
      if (file.id && file.mimeType !== DRIVE_FOLDER_MIME) found.set(file.id, { raw: file, folder: null });
    }
  } else {
    // 1. The Meet Recordings folder, if the user has one.
    const folderHit = await browseDrive(args.profileId, { search: "Meet Recordings" });
    const folders = (folderHit.files as Raw[]).filter((f) => f.mimeType === DRIVE_FOLDER_MIME);
    for (const folder of folders.slice(0, 3)) {
      if (!folder.id) continue;
      const inside = await browseDrive(args.profileId, { folderId: folder.id });
      for (const file of inside.files as Raw[]) {
        if (file.id && file.mimeType !== DRIVE_FOLDER_MIME) {
          found.set(file.id, { raw: file, folder: folder.name ?? "Meet Recordings" });
        }
      }
    }
    // 2. Title heuristics across the rest of the Drive.
    for (const term of TRANSCRIPT_TERMS) {
      const page = await browseDrive(args.profileId, { search: term });
      for (const file of page.files as Raw[]) {
        if (!file.id || file.mimeType === DRIVE_FOLDER_MIME) continue;
        if (found.has(file.id)) continue;
        if (!looksLikeTranscript(file.name, null)) continue;
        found.set(file.id, { raw: file, folder: null });
      }
    }
  }

  const items = Array.from(found.values())
    .filter(({ raw, folder }) => looksLikeTranscript(raw.name, folder))
    .map(({ raw, folder }) => ({
      id: raw.id ?? "",
      title: raw.name ?? "Untitled",
      subtitle: raw.mimeType ?? null,
      date: raw.modifiedTime ?? null,
      isFolder: false,
      alreadyInLasso: Boolean(raw.id && args.seen.has(raw.id)),
      hint: transcriptHint(raw.name, folder) ?? "Call transcript",
      isWatched: false,
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return { items, nextPageToken: null, unsupported: null };
}

/**
 * Imports only the ids the user ticked. A file that is already in Work keeps
 * its work item: unchanged content is left alone, changed content is recorded
 * as a new version so links pointing at the item survive the re-import.
 */
export async function importConnectorFiles(
  supabase: Client,
  args: {
    toolkit: BrowsableToolkit;
    profileId: string;
    orgId: string;
    userId: string;
    ids: string[];
    mimes?: Record<string, string> | null;
    folderName: string | null;
  },
): Promise<{ imported: number; skipped: number; updated: number; unchanged: number }> {
  const {
    storeFile,
    captureEvents,
    existingByProviderId,
    sha256Bytes,
    recordNewVersion,
  } = await import("@/lib/connector-import.server");
  const idKey = TOOLKIT_ID_KEY[args.toolkit];
  const existing = await existingByProviderId(
    supabase,
    args.profileId,
    TOOLKIT_SOURCE[args.toolkit],
    idKey,
  );
  const newIds: string[] = [];
  const touchedIds: string[] = [];
  let imported = 0;
  let skipped = 0;
  let updated = 0;
  let unchanged = 0;

  const msAuth =
    args.toolkit === "googledrive" ? null : await auth(supabase, args.profileId, args.toolkit);

  for (const id of args.ids) {
    let file: {
      bytes: Uint8Array;
      mimeType: string;
      name: string;
      webViewLink: string | null;
    } | null = null;

    if (args.toolkit === "googledrive") {
      const { fetchDriveFileBytes } = await import("@/lib/composio.server");
      file = await fetchDriveFileBytes(args.profileId, id, args.mimes?.[id] ?? null);
    } else if (msAuth) {
      const { fetchMicrosoftFileBytes } = await import("@/lib/microsoft.server");
      file = await fetchMicrosoftFileBytes(args.toolkit, msAuth.entityId, id, "file");
    }

    if (!file) {
      skipped += 1;
      continue;
    }

    const hash = await sha256Bytes(file.bytes);
    const prior = existing.get(id);

    if (prior) {
      if (prior.content_hash === hash) {
        unchanged += 1;
        continue;
      }
      const path = await storeFile(args.userId, file.name, file.bytes, file.mimeType);
      await recordNewVersion(supabase, {
        workItemId: prior.id,
        previousRef: prior.content_ref,
        previousHash: prior.content_hash,
        previousAt: prior.captured_at,
        newRef: path,
        newHash: hash,
        sourceEvent: "connector_reimport",
      });
      const update = await supabase
        .from("work_items")
        .update({ content_ref: path, content_hash: hash })
        .eq("id", prior.id);
      if (update.error) throw new Error(update.error.message);
      touchedIds.push(prior.id);
      updated += 1;
      continue;
    }

    const path = await storeFile(args.userId, file.name, file.bytes, file.mimeType);
    // A labelled guess: transcripts land as calls, and stay editable.
    const isTranscript = looksLikeTranscript(file.name, args.folderName);
    const insert = await supabase.from("work_items").insert({
      owner_id: args.profileId,
      org_id: args.orgId,
      type: isTranscript ? "call" : driveWorkType(file.mimeType),
      source: TOOLKIT_SOURCE[args.toolkit],
      source_vendor: TOOLKIT_VENDOR[args.toolkit],
      title: file.name,
      visibility: "unmapped",
      content_ref: path,
      content_hash: hash,
      content_fidelity: isTranscript ? "transcribed" : "verbatim",
      ts_precision: "capture",
      source_meta: { filename: file.name, mime_type: file.mimeType },
      meta: {
        [idKey]: id,
        mime_type: file.mimeType,
        web_view_link: file.webViewLink,
        ...(isTranscript ? { transcript_guess: true } : {}),
      },
    })
      .select("id")
      .maybeSingle();
    if (insert.error) throw new Error(insert.error.message);
    if (insert.data?.id) newIds.push(insert.data.id);
    if (insert.data?.id) {
      existing.set(id, {
        id: insert.data.id,
        content_ref: path,
        content_hash: hash,
        captured_at: new Date().toISOString(),
      });
    }
    imported += 1;
  }

  const { ensureExtracts } = await import("@/lib/extract.server");
  await ensureExtracts([...newIds, ...touchedIds]);

  await captureEvents(supabase, {
    orgId: args.orgId,
    userId: args.userId,
    toolkit: args.toolkit,
    source: TOOLKIT_VENDOR[args.toolkit],
    imported,
  });
  return { imported, skipped, updated, unchanged };
}
