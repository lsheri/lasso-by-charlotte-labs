import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { getItemText } from "./item-text.server";
import type { Catalogue } from "./record-catalogue.server";
import { catalogueLine, extractBlock } from "./record-catalogue.server";
import { EXTRACT_COLUMNS, headAndTail, unreadableLine } from "./reflect-context.server";
import type { ExtractRow } from "./reflect-context.server";

type Db = SupabaseClient<Database>;

const MAX_OPEN = 20;
const MAX_READ = 5;
const MAX_SEARCH_HITS = 30;
const MAX_TURNS = 40;

export type ToolState = {
  supabase: Db;
  ownerId: string;
  catalogue: Catalogue;
  rawBudget: number;
  rawUsed: number;
  deadline: number;
  opened: Set<string>;
  readFull: Set<string>;
  unreadable: Map<string, string | null>;
  /** Verbatim text the model has actually been given this turn. */
  quotable: string[];
  searches: number;
  toolCalls: number;
};

/**
 * Four tools, and nothing that can write. Everything they return is already
 * scoped to the owner's own record by the catalogue and by row level policy.
 */
export const RECORD_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_record",
      description:
        "Search the catalogued work for a word or phrase. Searches item titles, item summaries and the text of conversation turns. Returns matching catalogue lines. Use this before answering any question that names a topic, person, client or decision.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Words to search for." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_items",
      description:
        "Open the summary card for up to 20 catalogued items: what each one was, what was decided, who and what it mentions, and what it led to. Cheap. Use this to decide what is worth reading in full. Summaries are never quotable.",
      parameters: {
        type: "object",
        properties: {
          item_ids: {
            type: "array",
            items: { type: "string" },
            description: "Catalogue codes, for example i4, or item ids.",
          },
        },
        required: ["item_ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_items",
      description:
        "Read the full text of up to 5 items. Expensive and budgeted. Only text returned by this tool or by read_turns may be quoted.",
      parameters: {
        type: "object",
        properties: {
          item_ids: {
            type: "array",
            items: { type: "string" },
            description: "Catalogue codes, for example i4, or item ids.",
          },
        },
        required: ["item_ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_turns",
      description:
        "Read a range of turns from one conversation, in order, verbatim. Use when the exact wording of a prompt or reply matters.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "Catalogue code or item id." },
          from_turn: { type: "number", description: "First turn number. Defaults to 1." },
          to_turn: { type: "number", description: "Last turn number." },
        },
        required: ["item_id"],
        additionalProperties: false,
      },
    },
  },
];

function resolve(state: ToolState, raw: string): { id: string; code: string } | null {
  const key = raw.trim();
  const byCode = state.catalogue.byCode.get(key);
  if (byCode) return { id: byCode.id, code: byCode.code };
  const byId = state.catalogue.byId.get(key);
  if (byId) return { id: byId.id, code: byId.code };
  return null;
}

async function extractsFor(state: ToolState, ids: string[]): Promise<Map<string, ExtractRow>> {
  if (ids.length === 0) return new Map();
  const { data } = await state.supabase
    .from("work_item_extracts")
    .select(EXTRACT_COLUMNS)
    .in("work_item_id", ids);
  return new Map(((data ?? []) as ExtractRow[]).map((row) => [row.work_item_id, row]));
}

async function searchRecord(state: ToolState, query: string): Promise<string> {
  state.searches += 1;
  const term = query.trim().slice(0, 200);
  if (!term) return "Give a word or phrase to search for.";
  const inScope = new Set(state.catalogue.byId.keys());
  const hits = new Set<string>();

  const summaryHits = await state.supabase
    .from("work_item_extracts")
    .select("work_item_id")
    .eq("owner_id", state.ownerId)
    .textSearch("search_tsv", term, { type: "websearch" })
    .limit(100);
  for (const row of summaryHits.data ?? []) hits.add(row.work_item_id);

  const titleHits = await state.supabase
    .from("work_items")
    .select("id")
    .eq("owner_id", state.ownerId)
    .ilike("title", `%${term}%`)
    .limit(100);
  for (const row of titleHits.data ?? []) hits.add(row.id);

  const turnHits = await state.supabase
    .from("turns")
    .select("work_item_id")
    .textSearch("content", term, { type: "websearch" })
    .limit(200);
  for (const row of turnHits.data ?? []) hits.add(row.work_item_id);

  const matched = state.catalogue.entries.filter(
    (entry) => hits.has(entry.id) && inScope.has(entry.id),
  );
  if (matched.length === 0) {
    return `No catalogued work matches "${term}". Try a different word, or say plainly that the record has nothing on it.`;
  }
  const shown = matched.slice(-MAX_SEARCH_HITS);
  return [
    `${matched.length} item${matched.length === 1 ? "" : "s"} match "${term}"${matched.length > shown.length ? `, showing the ${shown.length} most recent` : ""}:`,
    ...shown.map(catalogueLine),
  ].join("\n");
}

async function openItems(state: ToolState, ids: string[]): Promise<string> {
  const resolved = ids
    .slice(0, MAX_OPEN)
    .map((raw) => resolve(state, raw))
    .filter((value): value is { id: string; code: string } => value !== null);
  if (resolved.length === 0) return "None of those ids are in the catalogue for this scope.";
  const extracts = await extractsFor(
    state,
    resolved.map((r) => r.id),
  );
  const blocks: string[] = [];
  for (const { id } of resolved) {
    const item = state.catalogue.items.get(id);
    const entry = state.catalogue.byId.get(id);
    if (!item || !entry) continue;
    state.opened.add(id);
    blocks.push(extractBlock(item, entry, extracts.get(id)));
  }
  return blocks.join("\n\n---\n\n");
}

async function readItems(state: ToolState, ids: string[]): Promise<string> {
  const resolved = ids
    .slice(0, MAX_READ)
    .map((raw) => resolve(state, raw))
    .filter((value): value is { id: string; code: string } => value !== null);
  if (resolved.length === 0) return "None of those ids are in the catalogue for this scope.";
  const blocks: string[] = [];
  for (const { id, code } of resolved) {
    const item = state.catalogue.items.get(id);
    if (!item) continue;
    if (state.rawUsed >= state.rawBudget) {
      blocks.push(
        `${code} ${item.title}\n  Not read: the reading budget for this answer is used up. Work with what you already have, and say what you did not read.`,
      );
      continue;
    }
    if (Date.now() > state.deadline) {
      blocks.push(
        `${code} ${item.title}\n  Not read: no time left for this answer. Answer with what you already have.`,
      );
      continue;
    }
    const result = await getItemText(state.supabase, item);
    const text = (result.text ?? "").trim();
    if (result.status === "unsupported" || result.status === "failed" || (!text && item.content_ref)) {
      state.unreadable.set(id, result.note ?? null);
      blocks.push(`${code} ${item.title}\n${unreadableLine(item.type, result.note ?? null)}`);
      continue;
    }
    if (!text) {
      blocks.push(`${code} ${item.title}\n  This item has no stored text.`);
      continue;
    }
    const remaining = state.rawBudget - state.rawUsed;
    const clipped = headAndTail(text, Math.min(40_000, remaining));
    state.rawUsed += clipped.text.length;
    state.readFull.add(id);
    state.quotable.push(clipped.text);
    blocks.push(
      `${code} ${item.title}${clipped.cut ? " (middle omitted)" : ""}\n  Full text:\n${clipped.text}`,
    );
  }
  return blocks.join("\n\n---\n\n");
}

async function readTurns(
  state: ToolState,
  itemId: string,
  fromTurn: number | undefined,
  toTurn: number | undefined,
): Promise<string> {
  const target = resolve(state, itemId);
  if (!target) return "That id is not in the catalogue for this scope.";
  const from = Math.max(1, Math.floor(fromTurn ?? 1));
  const to = Math.max(from, Math.floor(toTurn ?? from + MAX_TURNS - 1));
  const { data, error } = await state.supabase
    .from("turns")
    .select("turn_no, role, content")
    .eq("work_item_id", target.id)
    .gte("turn_no", from)
    .lte("turn_no", to)
    .order("turn_no", { ascending: true })
    .limit(MAX_TURNS);
  if (error) return `Those turns could not be read: ${error.message}`;
  const rows = data ?? [];
  if (rows.length === 0) return "That item has no turns in that range.";
  const item = state.catalogue.items.get(target.id);
  const body = rows
    .map((turn) => `TURN ${turn.turn_no} · ${turn.role.toUpperCase()}\n${turn.content}`)
    .join("\n\n");
  const remaining = Math.max(0, state.rawBudget - state.rawUsed);
  const clipped = headAndTail(body, Math.min(40_000, remaining || 4_000));
  state.rawUsed += clipped.text.length;
  state.readFull.add(target.id);
  state.quotable.push(clipped.text);
  return `${target.code} ${item?.title ?? ""}\n${clipped.text}`;
}

/** One tool call. A tool never throws: a failure is an answerable message. */
export async function runRecordTool(
  state: ToolState,
  name: string,
  argsJson: string,
): Promise<string> {
  state.toolCalls += 1;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return "Those arguments were not valid JSON. Try the call again.";
  }
  try {
    const ids = Array.isArray(args["item_ids"])
      ? (args["item_ids"] as unknown[]).map((value) => String(value))
      : [];
    switch (name) {
      case "search_record":
        return await searchRecord(state, String(args["query"] ?? ""));
      case "open_items":
        return await openItems(state, ids);
      case "read_items":
        return await readItems(state, ids);
      case "read_turns":
        return await readTurns(
          state,
          String(args["item_id"] ?? ""),
          typeof args["from_turn"] === "number" ? args["from_turn"] : undefined,
          typeof args["to_turn"] === "number" ? args["to_turn"] : undefined,
        );
      default:
        return `There is no tool called ${name}.`;
    }
  } catch (e) {
    console.error(`[record-tools] ${name} failed:`, (e as Error).message);
    return `That lookup failed: ${(e as Error).message}. Answer with what you already have.`;
  }
}