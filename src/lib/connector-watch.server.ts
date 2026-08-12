import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  parseWatchConfig,
  WATCH_INTERVAL_MS,
  WATCH_SEEN_CAP,
  type WatchConfig,
  type WatchFolder,
  type WatchSuggestion,
} from "@/lib/connector-watch-shared";
import { BROWSABLE_TOOLKITS, type BrowsableToolkit } from "@/lib/connector-toolkits";

type Client = SupabaseClient<Database>;

type Account = { id: string; toolkit: BrowsableToolkit; config: WatchConfig };

async function watchedAccounts(supabase: Client, profileId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from("connector_accounts")
    .select("id, toolkit, status, watch_config")
    .eq("profile_id", profileId)
    .eq("status", "connected");
  if (error) throw new Error(error.message);
  const out: Account[] = [];
  for (const row of data ?? []) {
    if (!(BROWSABLE_TOOLKITS as readonly string[]).includes(row.toolkit)) continue;
    out.push({
      id: row.id,
      toolkit: row.toolkit as BrowsableToolkit,
      config: parseWatchConfig(row.watch_config),
    });
  }
  return out;
}

async function writeConfig(supabase: Client, accountId: string, config: WatchConfig) {
  const { error } = await supabase
    .from("connector_accounts")
    .update({ watch_config: config as unknown as Database["public"]["Tables"]["connector_accounts"]["Row"]["watch_config"] })
    .eq("id", accountId);
  if (error) throw new Error(error.message);
}

/** Every non-folder id currently inside a watched folder. */
async function folderFileIds(
  supabase: Client,
  profileId: string,
  toolkit: BrowsableToolkit,
  folderId: string,
): Promise<string[]> {
  const { browseConnector } = await import("@/lib/connector-browse.server");
  const page = await browseConnector(supabase, {
    toolkit,
    profileId,
    folderId,
    folderName: null,
    search: null,
    pageToken: null,
    seen: new Set<string>(),
    watched: new Set<string>(),
  });
  return page.items.filter((item) => !item.isFolder && item.id).map((item) => item.id);
}

/** Turn a watch on or off. Enabling records what is already there, so the
 *  first diff only ever reports work that arrived afterwards. */
export async function setWatch(
  supabase: Client,
  args: {
    profileId: string;
    toolkit: BrowsableToolkit;
    folderId: string;
    folderName: string;
    watch: boolean;
  },
): Promise<{ watched: boolean }> {
  const { data, error } = await supabase
    .from("connector_accounts")
    .select("id, watch_config")
    .eq("profile_id", args.profileId)
    .eq("toolkit", args.toolkit)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That connection has expired. Reconnect it on Where work lives.");

  const config = parseWatchConfig(data.watch_config);
  const rest = config.folders.filter((f) => f.id !== args.folderId);

  if (!args.watch) {
    await writeConfig(supabase, data.id, { folders: rest });
    return { watched: false };
  }

  const baseline = await folderFileIds(supabase, args.profileId, args.toolkit, args.folderId);
  const folder: WatchFolder = {
    id: args.folderId,
    name: args.folderName,
    source: args.toolkit,
    last_checked_iso: new Date().toISOString(),
    last_seen_file_ids: baseline.slice(0, WATCH_SEEN_CAP),
  };
  await writeConfig(supabase, data.id, { folders: [...rest, folder].slice(0, 25) });
  return { watched: true };
}

export async function watchedFolderIds(
  supabase: Client,
  profileId: string,
  toolkit: BrowsableToolkit,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("connector_accounts")
    .select("watch_config")
    .eq("profile_id", profileId)
    .eq("toolkit", toolkit)
    .maybeSingle();
  return new Set(parseWatchConfig(data?.watch_config).folders.map((f) => f.id));
}

/**
 * Diff every watched folder that hasn't been looked at for 30 minutes.
 * Sources are walked one at a time, never in parallel, and NOTHING is
 * imported — the result is a list of suggestions the owner can act on.
 */
export async function checkWatches(
  supabase: Client,
  profileId: string,
): Promise<{ suggestions: WatchSuggestion[] }> {
  const accounts = await watchedAccounts(supabase, profileId);
  const suggestions: WatchSuggestion[] = [];
  const now = Date.now();

  for (const account of accounts) {
    if (account.config.folders.length === 0) continue;

    // One check per source per 30 minutes, at most.
    const freshest = account.config.folders.reduce((acc, f) => {
      const t = f.last_checked_iso ? Date.parse(f.last_checked_iso) : 0;
      return Number.isFinite(t) && t > acc ? t : acc;
    }, 0);
    if (now - freshest < WATCH_INTERVAL_MS) {
      // Still report what the last pass found but hasn't been reviewed.
      continue;
    }

    const { importedToolkitIds } = await import("@/lib/connector-import.server");
    const imported = await importedToolkitIds(supabase, profileId, account.toolkit);
    const next: WatchFolder[] = [];

    for (const folder of account.config.folders) {
      let ids: string[] = [];
      try {
        ids = await folderFileIds(supabase, profileId, account.toolkit, folder.id);
      } catch {
        next.push(folder);
        continue;
      }
      const seen = new Set(folder.last_seen_file_ids);
      const fresh = ids.filter((id) => !seen.has(id) && !imported.has(id));
      if (fresh.length > 0) {
        suggestions.push({
          folder_id: folder.id,
          folder_name: folder.name,
          source: account.toolkit,
          new_count: fresh.length,
        });
      }
      // last_checked moves; last_seen only moves on dismiss or import.
      next.push({ ...folder, last_checked_iso: new Date().toISOString() });
    }

    await writeConfig(supabase, account.id, { folders: next });
  }

  return { suggestions };
}

/** Dismiss = "I've seen these" — the ids are remembered, nothing is imported. */
export async function dismissWatch(
  supabase: Client,
  args: { profileId: string; toolkit: BrowsableToolkit; folderId: string },
): Promise<void> {
  const { data } = await supabase
    .from("connector_accounts")
    .select("id, watch_config")
    .eq("profile_id", args.profileId)
    .eq("toolkit", args.toolkit)
    .maybeSingle();
  if (!data) return;
  const config = parseWatchConfig(data.watch_config);
  const ids = await folderFileIds(supabase, args.profileId, args.toolkit, args.folderId).catch(
    () => [] as string[],
  );
  const folders = config.folders.map((folder) =>
    folder.id === args.folderId
      ? {
          ...folder,
          last_checked_iso: new Date().toISOString(),
          last_seen_file_ids: Array.from(
            new Set([...ids, ...folder.last_seen_file_ids]),
          ).slice(0, WATCH_SEEN_CAP),
        }
      : folder,
  );
  await writeConfig(supabase, data.id, { folders });
}