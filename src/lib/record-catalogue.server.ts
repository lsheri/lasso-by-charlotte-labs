import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { AiReadInput } from "./ai-reads.server";
import { loadBriefContext } from "./brief.server";
import {
  EXTRACT_COLUMNS,
  buildEngagementBlocks,
  effectiveDate,
  extractLines,
  loadScopeData,
  taskLabels,
  type ExtractRow,
  type ItemRow,
} from "./reflect-context.server";
import type { ContextScope, ContextSource } from "./reflect-shared";

type Db = SupabaseClient<Database>;

/**
 * Below this, pouring the whole scope into the prompt is cheaper and better
 * than making the model fetch it. Above it, the record must be searched.
 */
export const CATALOGUE_THRESHOLD = 25;

/** Extracts prefetched before the first model call, so easy questions need no tools. */
const PREFETCH_RECENT = 5;

/** How many items are in scope, without loading any content. */
export async function scopeItemCount(
  supabase: Db,
  ownerId: string,
  scope: ContextScope,
): Promise<number> {
  if (scope.mode === "items") return scope.ids.length;
  if (scope.mode === "whole") {
    const { count } = await supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId);
    return count ?? 0;
  }
  const { items } = await loadScopeData(supabase, ownerId, scope);
  return items.length;
}

export type CatalogueEntry = {
  code: string;
  id: string;
  title: string;
  type: string;
  date: string;
  mapped: string | null;
  vendor: string | null;
  entities: string | null;
};

export type Catalogue = {
  entries: CatalogueEntry[];
  byCode: Map<string, CatalogueEntry>;
  byId: Map<string, CatalogueEntry>;
  items: Map<string, ItemRow>;
  structure: string[];
  brief: {
    block: string;
    chars: number;
    itemIds: string[];
    reads: AiReadInput[];
    sources: ContextSource[];
  };
  prefetched: Map<string, string>;
};

export function catalogueLine(entry: CatalogueEntry): string {
  return [
    entry.code,
    entry.date.slice(0, 10),
    entry.type,
    ...(entry.vendor ? [entry.vendor] : []),
    entry.mapped ?? "unmapped",
    entry.title,
    entry.entities ? entry.entities.slice(0, 160) : "",
  ].join(" | ");
}

/**
 * Codes are derived from the item's uuid, not its position. A sparse space
 * means an invented code misses loudly instead of resolving to a real item
 * the model never saw.
 */
export function assignCatalogueCodes(ids: string[]): Map<string, string> {
  const hex = new Map(ids.map((id) => [id, id.replace(/-/g, "").toLowerCase()]));
  const lengths = new Map(ids.map((id) => [id, 4]));
  for (const width of [4, 6]) {
    const seen = new Map<string, string[]>();
    for (const id of ids) {
      if (lengths.get(id) !== width) continue;
      const key = hex.get(id)!.slice(0, width);
      const list = seen.get(key) ?? [];
      list.push(id);
      seen.set(key, list);
    }
    for (const [, group] of seen) {
      if (group.length < 2) continue;
      for (const id of group) lengths.set(id, width + 2);
    }
  }
  return new Map(ids.map((id) => [id, `[${hex.get(id)!.slice(0, lengths.get(id)!)}]`]));
}

async function readExtracts(supabase: Db, ids: string[]): Promise<ExtractRow[]> {
  if (ids.length === 0) return [];
  const out: ExtractRow[] = [];
  // Chunked so a large record never builds an unbounded URL.
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("work_item_extracts")
      .select(EXTRACT_COLUMNS)
      .in("work_item_id", ids.slice(i, i + 100));
    out.push(...((data ?? []) as ExtractRow[]));
  }
  return out;
}

export function extractBlock(item: ItemRow, entry: CatalogueEntry, extract: ExtractRow | undefined) {
  const lines = [
    `${entry.code} ${item.title}`,
    `  Type: ${item.type} · Date: ${entry.date.slice(0, 10)} · ${entry.mapped ? `Mapped to ${entry.mapped}` : "Unmapped"}${item.visibility === "private" ? " · MARKED PRIVATE" : ""}`,
  ];
  if (extract) lines.push(...extractLines(extract));
  else lines.push("  No summary has been made for this item yet.");
  return lines.join("\n");
}

/**
 * The index of the record: one line per item, and nothing hidden. Above the
 * threshold this replaces pouring every extract into the prompt, and the model
 * fetches what it needs through tools.
 */
export async function buildCatalogue(
  supabase: Db,
  ownerId: string,
  scope: ContextScope,
): Promise<Catalogue> {
  const { tasks, linkRows, items: allItems } = await loadScopeData(supabase, ownerId, scope);
  const brief = await loadBriefContext(supabase, ownerId, scope);
  const briefIds = new Set(brief.itemIds);
  const items = allItems.filter((item) => !briefIds.has(item.id));
  const mappedTo = taskLabels(tasks, linkRows);

  const oldestFirst = [...items].sort(
    (a, b) => new Date(effectiveDate(a)).getTime() - new Date(effectiveDate(b)).getTime(),
  );

  const extractRows = await readExtracts(
    supabase,
    items.map((i) => i.id),
  );
  const extractFor = new Map(extractRows.map((row) => [row.work_item_id, row]));

  const entries: CatalogueEntry[] = oldestFirst.map((item, index) => ({
    code: codes.get(item.id) ?? `[${item.id.slice(0, 4)}]`,
    id: item.id,
    title: item.title,
    type: item.type,
    date: effectiveDate(item),
    mapped: mappedTo.get(item.id) ?? null,
    vendor: item.source_vendor,
    entities: extractFor.get(item.id)?.entities ?? null,
  }));

  const byCode = new Map(entries.map((entry) => [entry.code, entry]));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const itemsById = new Map(items.map((item) => [item.id, item]));

  // Named items always, then the most recent few, so the common question is
  // answerable without a single tool call.
  const named = scope.mode === "items" ? scope.ids : [];
  const recent = [...entries].reverse().slice(0, PREFETCH_RECENT);
  const prefetchIds = Array.from(new Set([...named, ...recent.map((entry) => entry.id)]));
  const prefetched = new Map<string, string>();
  for (const id of prefetchIds) {
    const item = itemsById.get(id);
    const entry = byId.get(id);
    if (!item || !entry) continue;
    prefetched.set(id, extractBlock(item, entry, extractFor.get(id)));
  }

  return {
    entries,
    byCode,
    byId,
    items: itemsById,
    structure: buildEngagementBlocks(tasks, linkRows, items),
    brief,
    prefetched,
  };
}