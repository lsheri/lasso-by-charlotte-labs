import type { BrowsableToolkit } from "@/lib/connector-toolkits";

/** connector_accounts.watch_config — a consent-safe list of watched folders. */
export type WatchFolder = {
  id: string;
  name: string;
  source: BrowsableToolkit;
  last_checked_iso: string | null;
  /** Capped so the jsonb column stays small. */
  last_seen_file_ids: string[];
};

export type WatchConfig = { folders: WatchFolder[] };

export const WATCH_SEEN_CAP = 200;
export const WATCH_INTERVAL_MS = 30 * 60 * 1000;

export type WatchSuggestion = {
  folder_id: string;
  folder_name: string;
  source: BrowsableToolkit;
  new_count: number;
  /** Provider ids of the new files, so the picker can highlight them. */
  new_ids: string[];
};

/** 1-2 · 3-9 · 10+ — the only shape of a count that leaves the browser. */
export function suggestionBucket(n: number): string {
  if (n <= 2) return "1-2";
  if (n <= 9) return "3-9";
  return "10+";
}

export function parseWatchConfig(raw: unknown): WatchConfig {
  const folders = (raw as { folders?: unknown } | null)?.folders;
  if (!Array.isArray(folders)) return { folders: [] };
  const out: WatchFolder[] = [];
  for (const entry of folders) {
    const f = entry as Partial<WatchFolder>;
    if (typeof f?.id !== "string" || !f.id) continue;
    out.push({
      id: f.id,
      name: typeof f.name === "string" ? f.name : "Folder",
      source: f.source as BrowsableToolkit,
      last_checked_iso: typeof f.last_checked_iso === "string" ? f.last_checked_iso : null,
      last_seen_file_ids: Array.isArray(f.last_seen_file_ids)
        ? f.last_seen_file_ids.filter((v): v is string => typeof v === "string")
        : [],
    });
  }
  return { folders: out };
}