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

/** Imports only the ids the user ticked; already-imported ids are skipped. */
export async function importConnectorFiles(
  supabase: Client,
  args: {
    toolkit: BrowsableToolkit;
    profileId: string;
    orgId: string;
    userId: string;
    ids: string[];
    folderName: string | null;
  },
): Promise<{ imported: number; skipped: number }> {
  const { importedToolkitIds, storeFile, captureEvents } =
    await import("@/lib/connector-import.server");
  const seen = await importedToolkitIds(supabase, args.profileId, args.toolkit);
  const idKey = TOOLKIT_ID_KEY[args.toolkit];
  let imported = 0;
  let skipped = 0;

  const msAuth =
    args.toolkit === "googledrive" ? null : await auth(supabase, args.profileId, args.toolkit);

  for (const id of args.ids) {
    if (seen.has(id)) {
      skipped += 1;
      continue;
    }

    let file: {
      bytes: Uint8Array;
      mimeType: string;
      name: string;
      webViewLink: string | null;
    } | null = null;

    if (args.toolkit === "googledrive") {
      const { fetchDriveFileBytes } = await import("@/lib/composio.server");
      file = await fetchDriveFileBytes(args.profileId, id);
    } else if (msAuth) {
      const { fetchMicrosoftFileBytes } = await import("@/lib/microsoft.server");
      file = await fetchMicrosoftFileBytes(args.toolkit, msAuth.entityId, id, "file");
    }

    if (!file) {
      skipped += 1;
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
      content_fidelity: isTranscript ? "transcribed" : "verbatim",
      ts_precision: "capture",
      source_meta: { filename: file.name, mime_type: file.mimeType },
      meta: {
        [idKey]: id,
        mime_type: file.mimeType,
        web_view_link: file.webViewLink,
        ...(isTranscript ? { transcript_guess: true } : {}),
      },
    });
    if (insert.error) throw new Error(insert.error.message);
    seen.add(id);
    imported += 1;
  }

  await captureEvents(supabase, {
    orgId: args.orgId,
    userId: args.userId,
    toolkit: args.toolkit,
    source: TOOLKIT_VENDOR[args.toolkit],
    imported,
  });
  return { imported, skipped };
}
