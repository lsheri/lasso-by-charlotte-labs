import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { INLINE_CHAR_BUDGET } from "./context-budget";
import {
  clientDisplayName,
  engagementDisplayCode,
  engagementDisplayTitle,
} from "@/lib/clients";

import type { AiReadInput, AiReadRole } from "./ai-reads.server";
import type { RecordDocument } from "./ai.server";
import { loadBriefContext } from "./brief.server";
import {
  manifestKind,
  wordCountLabel,
  type ContextManifest,
  type ManifestExcluded,
  type ManifestItem,
  type ManifestReadSet,
} from "./context-manifest";
import { ensureExtract, type ClassifiableItem } from "./extract.server";
import { ITEM_TEXT_COLUMNS, getItemText, type ItemTextStatus } from "./item-text.server";
import type { ContextScope, ContextSource } from "./reflect-shared";
import { naturalTurnLabels, turnNumbersIn } from "./turn-labels";
import { readFromRendition } from "./reference-rendition-shared";

/**
 * TOTAL-1: the read set is read as written. The budget is the window, not a
 * tier: about 860k tokens at the measured 1.6 chars per token (FIX-1, see
 * context-budget.ts), inside the 1M window with room for prompts, history
 * and the answer. Above
 * it the person is told, never silently summarised. A single item is only
 * ever cut when it alone would not fit.
 */
const RAW_BUDGET = INLINE_CHAR_BUDGET;
const PER_ITEM_CHARS = 1_200_000;
/** When an item must be cut, the head keeps the framing and the tail keeps the decisions. */
const HEAD_SHARE = 0.2;
const OMITTED_MARKER = "[... middle of this item omitted ...]";
/**
 * Backfilling is a side effect of asking a question, so almost none of it
 * happens on the critical path. Two are made to wait; the rest are started
 * and left to finish, and are simply there for the next question.
 */
const MAX_BACKFILL_INLINE = 2;
/** Pulling raw text is I/O plus parsing. Stop spending on it after this. */
const TEXT_BUDGET_MS = 25_000;
/** How many files are opened at once. Accounting stays strictly serial. */
const TEXT_FETCH_CHUNK = 4;
/** TOTAL-3: above this many items the all-at-once open falls back to chunks, to keep storage connections bounded. */
const TEXT_FETCH_ALL_MAX = 60;

type Db = SupabaseClient<Database>;

export type ItemRow = ClassifiableItem & {
  title: string;
  source: string;
  visibility: string;
  captured_at: string;
  work_date: string | null;
  created_at_source: string | null;
  content_fidelity: string | null;
  source_vendor: string | null;
  ts_precision?: string | null;
};


export type TaskRow = {
  id: string;
  name: string;
  goal: string | null;
  detail: string | null;
  when_label: string | null;
  status: string;
  position: number;
  engagement_id: string;
  engagements: {
    id: string;
    code: string;
    title: string;
    client_label: string | null;
    brief: string | null;
    term_label: string | null;
    outcome: string | null;
    clients: { id: string; name: string; quick_folder: boolean } | null;
  } | null;
};

export type LinkRow = {
  work_item_id: string;
  task_id: string;
  step_no: number | null;
  step_confirmed: boolean;
};

export type ExtractRow = {
  work_item_id: string;
  summary: string;
  decisions: string | null;
  entities: string | null;
  handoff: string | null;
};

export const EXTRACT_COLUMNS = "work_item_id, summary, decisions, entities, handoff";

export type { ContextSource };

export type AssembledContext = {
  context: string;
  /** Only text the model actually saw verbatim: the brief and full raw text. */
  quotable: string;
  truncated: boolean;
  itemCount: number;
  tier1Count: number;
  tier2Count: number;
  unreadableCount: number;
  /** R3a: items read in full whose text came from a rendition. */
  renditionsRead?: number;
  reads: AiReadInput[];
  sources: ContextSource[];
  /** Exactly what went into the prompt, for the person to inspect after. */
  manifest: ContextManifest;
  /** TOTAL-1: the read-set proof line, also carried on the manifest. */
  readSet: ManifestReadSet;
  /** TOTAL-1: the record index of the whole board, read set and the rest marked not read. */
  recordIndex: string;
  /** TOTAL-1: every item read, as a citable document, oldest first. */
  documents: RecordDocument[];
  /** TOTAL-1: the record minus the documents: brief, index, structure, and the lines for items not read. */
  preamble: string;
};

/** TOTAL-1: one row of the record index, for the whole board the scope sits on. */
export type IndexRow = {
  id: string;
  title: string;
  type: string;
  date: string;
  selected: boolean;
  turns: number | null;
  chars: number | null;
  charsExact: boolean;
};

/**
 * The record index: every item on the board in one line each, so a count or a
 * "what else is here" question has exact numbers to read, and so a selection
 * never hides the shape of the board it came from. Unselected items are
 * marked not read and carry no content.
 */
export function recordIndexBlock(rows: IndexRow[], boardName: string | null): string {
  if (rows.length === 0) return "";
  const selected = rows.filter((r) => r.selected).length;
  const threads = rows.filter((r) => r.type === "ai_thread");
  const turnsKnown = threads.filter((r) => r.turns !== null);
  const totalTurns = turnsKnown.reduce((sum, r) => sum + (r.turns ?? 0), 0);
  const lines = [
    `RECORD INDEX${boardName ? ` for workboard ${boardName}` : ""}: ${rows.length} item${rows.length === 1 ? "" : "s"}, ${threads.length} conversation${threads.length === 1 ? "" : "s"}${turnsKnown.length === threads.length ? ` with ${totalTurns} turns in total` : ""}. ${selected} of ${rows.length} ${selected === 1 ? "is" : "are"} in the read set below, as written. Items marked NOT READ are on the board but were not selected for this question; you know they exist and nothing else about them.`,
  ];
  rows.forEach((r, i) => {
    const kind = r.type === "ai_thread" ? "conversation" : r.type;
    const size =
      r.type === "ai_thread"
        ? r.turns !== null
          ? `${r.turns} turn${r.turns === 1 ? "" : "s"}`
          : "turns not stored"
        : r.chars !== null && r.chars > 0
          ? `${r.charsExact ? "" : "about "}${r.chars.toLocaleString("en-GB")} characters`
          : "no stored text";
    lines.push(`  ${i + 1}. ${r.title} (${kind}, ${r.date}, ${size})${r.selected ? "" : " NOT READ"}`);
  });
  return lines.join("\n");
}

/**
 * The proof line for one item, derived from the text that actually went into
 * the prompt. A conversation reports the turns that are in there, a file
 * reports the words that are in there. Nothing is estimated.
 */
function detailFor(item: ItemRow, raw: string): string {
  const cut = raw.includes(OMITTED_MARKER);
  if (item.type === "ai_thread") {
    const turns = [...raw.matchAll(/^TURN (\d+) /gm)].map((m) => Number(m[1]));
    if (turns.length > 0) {
      const first = Math.min(...turns);
      const last = Math.max(...turns);
      const range = first === last ? `turn ${first}` : `turns ${first}\u2013${last}`;
      return cut ? `${range}, middle omitted` : range;
    }
  }
  const words = wordCountLabel(raw);
  return cut ? `${words} read, middle omitted` : words;
}

/**
 * For a hand picked set of items, the engagement they sit in and the work in
 * that engagement that was left out. Both are things the person can check.
 */
async function selectionContext(
  supabase: Db,
  ownerId: string,
  includedIds: string[],
): Promise<{ engagement: { id: string; name: string } | null; excluded: ManifestExcluded[] }> {
  const none = { engagement: null, excluded: [] as ManifestExcluded[] };
  if (includedIds.length === 0 || includedIds.length > 50) return none;
  const { data: links } = await supabase
    .from("work_item_tasks")
    .select("task_id")
    .in("work_item_id", includedIds);
  const taskIds = [...new Set((links ?? []).map((l) => l.task_id))];
  if (taskIds.length === 0) return none;
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, engagement_id, engagements(id, title, code, client_label, clients(id, name, quick_folder))",
    )
    .in("id", taskIds);
  const first = (tasks ?? []).find((t) => t.engagements) as
    | {
        engagement_id: string;
        engagements: {
          id: string;
          title: string;
          code: string;
          client_label: string | null;
          clients: { id: string; name: string; quick_folder: boolean } | null;
        };
      }
    | undefined;
  if (!first) return none;
  const engagement = { id: first.engagements.id, name: engagementDisplayTitle(first.engagements) };

  const { data: siblingTasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("engagement_id", first.engagement_id);
  const siblingTaskIds = (siblingTasks ?? []).map((t) => t.id);
  if (siblingTaskIds.length === 0) return { engagement, excluded: [] };
  const { data: siblingLinks } = await supabase
    .from("work_item_tasks")
    .select("work_item_id")
    .in("task_id", siblingTaskIds);
  const included = new Set(includedIds);
  const leftOut = [...new Set((siblingLinks ?? []).map((l) => l.work_item_id))].filter(
    (id) => !included.has(id),
  );
  if (leftOut.length === 0) return { engagement, excluded: [] };
  const { data: leftOutItems } = await supabase
    .from("work_items")
    .select("id, title")
    .in("id", leftOut.slice(0, 40));
  return {
    engagement,
    excluded: (leftOutItems ?? []).map((row) => ({
      title: row.title,
      reason: "not selected for this question",
    })),
  };
}

/**
 * The honesty guard. An item we could not open still appears in the context,
 * marked so plainly that the model cannot mistake it for something it read.
 */
export function unreadableLine(type: string, note: string | null): string {
  return `  CONTENT COULD NOT BE READ (${note ?? "scanned or unsupported format"}). You have NOT seen this ${type === "sheet" ? "spreadsheet" : "file"}. Do not describe, summarise or quote it.`;
}

export function effectiveDate(item: ItemRow): string {
  return item.work_date ?? item.created_at_source ?? item.captured_at;
}

/**
 * The date line for an item, stated at the precision the source actually
 * supplies. A capture date is never dressed up as the day the work happened,
 * so a reconstruction of sequence can say what it knows and no more.
 */
export function datePrecisionLine(item: ItemRow): string {
  const meta = (item.source_meta ?? null) as {
    modified_at?: string | null;
    sent_at?: string | null;
  } | null;
  const day = (value: string) => value.slice(0, 10);
  if (meta?.modified_at) return `modified ${day(meta.modified_at)}`;
  if (meta?.sent_at) return `sent ${day(meta.sent_at)}`;
  if (item.work_date && item.ts_precision === "source") return day(item.work_date);
  return `captured ${day(item.captured_at)}`;
}


/**
 * Endings carry the decisions, so a cut item keeps its head AND its tail, and
 * the cut is sized to the cap it was given. The old constants ignored the cap,
 * so the last item of a full budget always landed at 40k whatever room was
 * left; now the room decides.
 */
export function headAndTail(text: string, cap = PER_ITEM_CHARS): { text: string; cut: boolean } {
  if (text.length <= cap) return { text, cut: false };
  // Too little room for a marker and both ends: keep the tail, which is where
  // the decisions live, and still report the cut.
  if (cap <= OMITTED_MARKER.length + 16) return { text: text.slice(-Math.max(0, cap)), cut: true };
  const room = Math.max(0, cap - OMITTED_MARKER.length - 4);
  const head = Math.floor(room * HEAD_SHARE);
  const tail = room - head;
  return {
    text: `${text.slice(0, head)}\n\n${OMITTED_MARKER}\n\n${tail > 0 ? text.slice(-tail) : ""}`,
    cut: true,
  };
}

export { RAW_BUDGET };

export type TextFetchResult = {
  item: { id: string; content_ref?: string | null };
  result: { status: ItemTextStatus; text?: string | null; note?: string | null };
};

/**
 * The budget, clip and stop decisions for a batch of fetched texts, applied in
 * the order given. Pure apart from the two maps it fills, which is what makes
 * the parallel fetch above safe: order in, order out.
 */
export function accountTextResults(
  fetched: TextFetchResult[],
  rawBudget: number,
  state: {
    fullText: Map<string, string>;
    unreadable: Map<string, { status: ItemTextStatus; note: string | null }>;
    rawUsed: number;
    /** TOTAL-1: stored characters per item, before any cut. Optional for older callers. */
    charsTotal?: Map<string, number>;
  },
): { rawUsed: number; anyCut: boolean; stop: boolean } {
  let rawUsed = state.rawUsed;
  let anyCut = false;
  for (const { item, result } of fetched) {
    if (rawUsed >= rawBudget) return { rawUsed, anyCut, stop: true };
    if (result.status === "unsupported" || result.status === "failed") {
      state.unreadable.set(item.id, { status: result.status, note: result.note ?? null });
      continue;
    }
    if (result.status === "unreadable" && item.content_ref) {
      state.unreadable.set(item.id, { status: "unreadable", note: result.note ?? null });
      continue;
    }
    const text = (result.text ?? "").trim();
    if (!text) continue;
    state.charsTotal?.set(item.id, text.length);
    const clipped = headAndTail(text);
    if (clipped.cut) anyCut = true;
    const remaining = rawBudget - rawUsed;
    if (clipped.text.length > remaining) {
      anyCut = true;
      const room = headAndTail(clipped.text, remaining);
      state.fullText.set(item.id, room.text);
      return { rawUsed: rawBudget, anyCut, stop: true };
    }
    state.fullText.set(item.id, clipped.text);
    rawUsed += clipped.text.length;
  }
  return { rawUsed, anyCut, stop: false };
}

/**
 * An @ mention narrows one message to exactly what the person pointed at.
 * Everything else in the session's scope is honestly listed as not read, and
 * anything pointed at that does not belong to this scope is refused.
 */
export async function narrowToPointed(
  supabase: Db,
  ownerId: string,
  sessionScope: ContextScope,
  pointedIds: string[],
): Promise<{ scope: ContextScope; excluded: ManifestExcluded[]; offBoard: string[] }> {
  const { items } = await loadScopeData(supabase, ownerId, sessionScope);
  const inScope = new Map(items.map((i) => [i.id, i.title]));
  const wanted = new Set(pointedIds);
  const allowed = pointedIds.filter((id) => inScope.has(id));

  // FIX-2: a pointed item outside the read set is named, never read. The
  // lookup goes through the person's own login, so an item they cannot see
  // returns no row and stays silent: Lasso does not confirm it exists.
  const excluded: ManifestExcluded[] = [];
  const offBoard: string[] = [];
  const strays = pointedIds.filter((id) => !inScope.has(id));
  if (strays.length > 0) {
    const { data } = await supabase.from("work_items").select("id, title").in("id", strays);
    for (const row of data ?? []) {
      excluded.push({ title: row.title, reason: "not part of this workboard" });
      offBoard.push(row.title);
    }
  }
  if (allowed.length === 0) return { scope: sessionScope, excluded, offBoard };

  for (const [id, title] of inScope) {
    if (!wanted.has(id)) excluded.push({ title, reason: "not pointed at for this question" });
  }
  return { scope: { mode: "items", ids: allowed }, excluded, offBoard };
}

/**
 * Steps 1 to 3 of assembly: which tasks, which mapping links, which items.
 * Shared with the catalogue so both paths see exactly the same scope.
 */
export async function loadScopeData(
  supabase: Db,
  ownerId: string,
  scope: ContextScope,
): Promise<{ tasks: TaskRow[]; linkRows: LinkRow[]; items: ItemRow[] }> {
  if (scope.mode !== "whole" && scope.ids.length === 0) {
    return { tasks: [], linkRows: [], items: [] };
  }
  async function loadTasksAndLinks(): Promise<{ tasks: TaskRow[]; linkRows: LinkRow[] }> {
    let taskQuery = supabase
      .from("tasks")
      .select(
        "id, name, goal, detail, when_label, status, position, engagement_id, engagements(id, code, title, client_label, brief, term_label, outcome, clients(id, name, quick_folder))",
      )
      .eq("owner_id", ownerId);
    if (scope.mode === "engagements" && scope.ids.length > 0) {
      taskQuery = taskQuery.in("engagement_id", scope.ids);
    } else if (scope.mode === "tasks" && scope.ids.length > 0) {
      taskQuery = taskQuery.in("id", scope.ids);
    }
    const tasksRes = scope.mode === "items" ? { data: [], error: null } : await taskQuery;
    if (tasksRes.error) throw new Error(tasksRes.error.message);
    const tasks = (tasksRes.data ?? []) as unknown as TaskRow[];

    const links = tasks.length
      ? await supabase
          .from("work_item_tasks")
          .select("work_item_id, task_id, step_no, step_confirmed")
          .in(
            "task_id",
            tasks.map((t) => t.id),
          )
      : { data: [], error: null };
    if (links.error) throw new Error(links.error.message);
    return { tasks, linkRows: (links.data ?? []) as LinkRow[] };
  }

  async function loadItems(linkRows: LinkRow[] | null): Promise<ItemRow[]> {
    let itemQuery = supabase
      .from("work_items")
      .select(
        `${ITEM_TEXT_COLUMNS}, source, visibility, captured_at, work_date, created_at_source, content_fidelity, source_vendor, ts_precision`,
      )
      .eq("owner_id", ownerId)
      .order("captured_at", { ascending: false })
      .limit(300);
    if (scope.mode === "items" && scope.ids.length > 0) {
      itemQuery = itemQuery.in("id", scope.ids);
    } else if (scope.mode !== "whole") {
      const ids = (linkRows ?? []).map((l) => l.work_item_id);
      if (ids.length === 0) itemQuery = itemQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
      else itemQuery = itemQuery.in("id", ids);
    }
    const itemsRes = await itemQuery;
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    return (itemsRes.data ?? []) as unknown as ItemRow[];
  }

  // Only "items" and "whole" leave the item query independent of the mapping
  // links. Engagement and task scopes keep their genuine dependency chain.
  if (scope.mode === "items" || scope.mode === "whole") {
    const [taskData, items] = await Promise.all([loadTasksAndLinks(), loadItems(null)]);
    return { ...taskData, items };
  }
  const { tasks, linkRows } = await loadTasksAndLinks();
  return { tasks, linkRows, items: await loadItems(linkRows) };
}

/** "ENG-1 · Discovery" for a mapped item, undefined when unmapped. */
export function taskLabels(tasks: TaskRow[], linkRows: LinkRow[]): Map<string, string> {
  const taskNameFor = new Map<string, string>();
  for (const link of linkRows) {
    const task = tasks.find((t) => t.id === link.task_id);
    const engagement = task?.engagements;
    if (task) {
      taskNameFor.set(
        link.work_item_id,
        engagement ? `${engagement.code} · ${task.name}` : task.name,
      );
    }
  }
  return taskNameFor;
}

/** The engagement and workstream structure block, identical in both paths. */
export function buildEngagementBlocks(
  tasks: TaskRow[],
  linkRows: LinkRow[],
  items: { id: string; title: string }[],
): string[] {
  const engagementBlocks = new Map<string, string>();
  for (const task of tasks) {
    const engagement = task.engagements;
    if (!engagement || engagementBlocks.has(engagement.id)) continue;
    const own = tasks
      .filter((t) => t.engagement_id === engagement.id)
      .sort((a, b) => a.position - b.position);
    const taskLines = own.map((t) => {
      const steps = linkRows
        .filter((l) => l.task_id === t.id)
        .sort((a, b) => (a.step_no ?? 999) - (b.step_no ?? 999))
        .map((l, index) => {
          const item = items.find((i) => i.id === l.work_item_id);
          return `      ${l.step_no ?? index + 1}. ${item?.title ?? "(item)"}${l.step_confirmed ? " [confirmed sequence]" : ""}`;
        });
      return [
        `    WORKSTREAM: ${t.name}${t.when_label ? ` (${t.when_label})` : ""}, status ${t.status}`,
        t.goal ? `      Goal: ${t.goal}` : null,
        t.detail ? `      Detail: ${t.detail}` : null,
        ...steps,
      ]
        .filter(Boolean)
        .join("\n");
    });
    engagementBlocks.set(
      engagement.id,
      [
        `WORKBOARD ${engagementDisplayCode(engagement) ?? "(folder)"}: ${engagementDisplayTitle(engagement)}`,
        clientDisplayName(engagement) ? `  Client: ${clientDisplayName(engagement)}` : null,
        engagement.term_label ? `  Term: ${engagement.term_label}` : null,
        engagement.brief ? `  Brief: ${engagement.brief}` : null,
        engagement.outcome ? `  Outcome: ${engagement.outcome}` : null,
        ...taskLines,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return [...engagementBlocks.values()];
}

/** The four extract fields, formatted the one way every surface shows them. */
export function extractLines(extract: ExtractRow): string[] {
  const lines = [`  Summary: ${extract.summary}`];
  if (extract.decisions) lines.push(`  Decided: ${extract.decisions}`);
  if (extract.entities) lines.push(`  Key names and topics: ${extract.entities}`);
  if (extract.handoff) lines.push(`  Led to: ${extract.handoff}`);
  return lines;
}

/**
 * Two tiers. Tier 1 is the structure plus a compact extract for every in-scope
 * item, so nothing is invisible. Tier 2 is full raw text for a prioritised,
 * budgeted subset. Everything is read as the caller, so row-level policies
 * decide what can be assembled at all.
 */
/**
 * IMG-3: board images in this read set, with their stored AI description.
 * Picked images come from scope.images; a whole-board (engagements) scope
 * includes every live image on those boards. Read with the caller's own client,
 * so row level security decides what is visible. An image never described yet
 * is described now (at most MAX_IMAGE_DESCRIBE_INLINE per ask), then re-read.
 */
export const MAX_IMAGE_DESCRIBE_INLINE = 4;
export const IMAGE_DESCRIPTION_LABEL = "AI description of an image on the board. Not the image itself.";
export type BoardImageRead = { id: string; text: string | null; status: string | null };

export function imageTitle(text: string | null): string {
  const first = (text ?? "").split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const clean = first.replace(/^1\.\s*/, "").slice(0, 90);
  return clean ? `Image: ${clean}` : "Image on the board";
}

export async function loadBoardImages(
  supabase: Db,
  scope: ContextScope,
  describe?: (nodeId: string) => Promise<unknown>,
): Promise<BoardImageRead[]> {
  const columns = "id, image_text, image_text_status";
  async function read(): Promise<{ id: string; image_text: string | null; image_text_status: string | null }[]> {
    if (scope.images && scope.images.length > 0) {
      const { data } = await supabase.from("workboard_nodes").select(columns).in("id", scope.images).eq("kind", "image").is("deleted_at", null);
      return (data ?? []) as { id: string; image_text: string | null; image_text_status: string | null }[];
    }
    if (scope.mode === "engagements" && scope.ids.length > 0) {
      const { data: boards } = await supabase.from("workboards").select("id").in("engagement_id", scope.ids);
      const boardIds = ((boards ?? []) as { id: string }[]).map((b) => b.id);
      if (boardIds.length === 0) return [];
      const { data } = await supabase.from("workboard_nodes").select(columns).in("workboard_id", boardIds).eq("kind", "image").is("deleted_at", null);
      return (data ?? []) as { id: string; image_text: string | null; image_text_status: string | null }[];
    }
    return [];
  }
  try {
    let rows = await read();
    const undescribed = rows.filter((row) => row.image_text_status === null).slice(0, MAX_IMAGE_DESCRIBE_INLINE);
    if (undescribed.length > 0) {
      const run = describe ?? (async (nodeId: string) => (await import("./image-describe.server")).describeBoardImage(nodeId));
      await Promise.all(undescribed.map((row) => run(row.id).catch(() => null)));
      rows = await read();
    }
    return rows
      .map((row) => ({ id: row.id, text: row.image_text_status === "ok" ? row.image_text : null, status: row.image_text_status }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    console.error("[reflect-context] board images:", (error as Error).message);
    return [];
  }
}

export async function assembleReflectContext(
  supabase: Db,
  profileId: string,
  scope: ContextScope,
  options?: { ownerProfileId?: string; readerRole?: AiReadRole; pointedAt?: boolean; briefOnly?: boolean },
): Promise<AssembledContext> {
  const ownerId = options?.ownerProfileId ?? profileId;

  // 1 to 3. Tasks, mapping links, and the work items themselves. The brief is
  // an independent read, so it happens alongside rather than after.
  const [{ tasks, linkRows, items: loadedItems }, brief] = await Promise.all([
    options?.briefOnly
      ? Promise.resolve({ tasks: [] as TaskRow[], linkRows: [] as LinkRow[], items: [] as ItemRow[] })
      : loadScopeData(supabase, ownerId, scope),
    loadBriefContext(supabase, ownerId, scope),
  ]);
  const allItems = loadedItems;

  // Tier 0. The brief is never budgeted away, and is removed from the ordinary
  // item list so it cannot also appear as an extract.
  const briefIds = new Set(brief.itemIds);
  const items = allItems.filter((item) => !briefIds.has(item.id));
  // Brief characters come out of the tier 2 budget, so total context does not grow.
  const rawBudget = Math.max(0, RAW_BUDGET - brief.chars);

  const taskNameFor = taskLabels(tasks, linkRows);

  // 4. Extracts for every in-scope item, backfilling a few that are missing.
  async function readExtracts(ids: string[]): Promise<ExtractRow[]> {
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("work_item_extracts")
      .select(EXTRACT_COLUMNS)
      .in("work_item_id", ids);
    return (data ?? []) as ExtractRow[];
  }

  const allIds = items.map((i) => i.id);
  let extractRows = await readExtracts(allIds);
  const have = new Set(extractRows.map((row) => row.work_item_id));
  const missing = allIds.filter((id) => !have.has(id));
  if (missing.length > 0) {
    const inline = missing.slice(0, MAX_BACKFILL_INLINE);
    const deferred = missing.slice(MAX_BACKFILL_INLINE);
    const started = Date.now();
    const results = await Promise.all(
      inline.map(async (id) => ({ id, ok: await ensureExtract(id) })),
    );
    const made = results.filter((r) => r.ok).map((r) => r.id);
    console.log(
      `[reflect-context] inline backfill ${made.length}/${inline.length} in ${Date.now() - started}ms, ${deferred.length} deferred`,
    );
    if (made.length > 0) extractRows = [...extractRows, ...(await readExtracts(made))];
    // Deliberately not awaited: the person's question must not wait on work
    // that only makes the NEXT answer better.
    for (const id of deferred) {
      void ensureExtract(id).catch(() => {
        /* a missing extract is never fatal */
      });
    }
  }
  const extractFor = new Map(extractRows.map((row) => [row.work_item_id, row]));

  // 5. Structure block, unchanged in shape.
  const engagementBlocks = buildEngagementBlocks(tasks, linkRows, items);

  // 6. Read order, founder's order of needs: conversations first (they are
  // the work itself), then anything the person named, then most recent. With
  // the budget at the window this only matters on a board that cannot fit.
  const byNewest = [...items].sort(
    (a, b) => new Date(effectiveDate(b)).getTime() - new Date(effectiveDate(a)).getTime(),
  );
  const named = scope.mode === "items" ? new Set(scope.ids) : new Set<string>();
  const rank = (i: ItemRow) => (i.type === "ai_thread" ? 0 : 1) * 2 + (named.has(i.id) ? 0 : 1);
  const priority = [...byNewest].sort((a, b) => rank(a) - rank(b));

  const fullText = new Map<string, string>();
  const unreadable = new Map<string, { status: ItemTextStatus; note: string | null }>();
  const charsTotal = new Map<string, number>();
  let rawUsed = 0;
  let anyCut = false;
  let renditionsRead = 0;
  const textStarted = Date.now();
  // TOTAL-3: when the read set's known size fits the window, every item is
  // opened at once (one round trip instead of one per chunk) and accounted
  // for in priority order afterwards. The chunked path stays for a read set
  // that may not fit, where opening order decides what gets in.
  const knownChars = priority.reduce((sum, item) => sum + storedCharsHint(item), 0);
  const fetchAll = knownChars > 0 && knownChars <= rawBudget * 0.9 && priority.length <= TEXT_FETCH_ALL_MAX;
  const step = fetchAll ? priority.length : TEXT_FETCH_CHUNK;
  for (let i = 0; i < priority.length; i += step) {
    // Once the budget or the clock is gone, stop opening files entirely: the
    // remaining items still appear, as their extract.
    if (rawUsed >= rawBudget || Date.now() - textStarted > TEXT_BUDGET_MS) break;
    const chunk = priority.slice(i, i + step);
    const fetched = await Promise.all(
      chunk.map(async (item) => ({ item, result: await getItemText(supabase, item) })),
    );
    const applied = accountTextResults(fetched, rawBudget, { fullText, unreadable, rawUsed, charsTotal });
    rawUsed = applied.rawUsed;
    for (const f of fetched) if (fullText.has(f.item.id) && readFromRendition(f.item, f.result.status)) renditionsRead += 1;
    if (applied.anyCut) anyCut = true;
    if (applied.stop) break;
  }
  console.log(
    `[reflect-context] text pass: ${fullText.size} full, ${unreadable.size} unreadable, ${Date.now() - textStarted}ms, ${fetchAll ? "all at once" : "chunked"}`,
  );

  // 6b. TOTAL-1: the record index of the whole board the scope sits on.
  const indexRows = await loadRecordIndex(supabase, ownerId, scope, tasks, items, fullText, charsTotal);
  const indexBoardName = tasks.find((t) => t.engagements)?.engagements?.title ?? null;
  const recordIndex = recordIndexBlock(indexRows, indexBoardName);

  // 7. Serialize oldest to newest so the record reads as a story. Engagement
  // scope orders on the day the work carries (work_date, else capture) so a
  // reconstruction of sequence reads the same order a person would.
  // FIX-1: any read set taken from a board (LOOK-2 tags it) reads in the
  // board's own order and date form, so the same items asked about from the
  // whole board or from a workstream assemble to the same bytes.
  const isEngagementScope = scope.mode === "engagements" || Boolean(scope.board);
  const sortKey = (item: ItemRow) =>
    new Date(
      isEngagementScope ? (item.work_date ?? item.captured_at) : effectiveDate(item),
    ).getTime();
  const oldestFirst = [...items].sort((a, b) => sortKey(a) - sortKey(b));


  // The brief sits above the engagement structure and above every item: long
  // framing material belongs at the top, and a stable prefix caches well.
  const parts: string[] = [brief.block, ...(recordIndex ? [recordIndex] : []), ...engagementBlocks];
  const reads: AiReadInput[] = [...brief.reads];
  const sources: ContextSource[] = [...brief.sources];
  let tier2 = brief.itemIds.length;
  let unreadableCount = 0;
  // Quotation is a promise of exact wording, so only verbatim text counts.
  // Titles and the structure block are exact words too: a quoted title must
  // never fail the guard and cost a second model call.
  const quotableParts: string[] = [brief.block, recordIndex, ...engagementBlocks, ...items.map((i) => i.title)];
  // TOTAL-1: the same record as citable documents, one per item read, in the
  // same oldest-first order. The preamble is everything that is not a document.
  const documents: RecordDocument[] = [];
  const preambleParts: string[] = [brief.block, ...(recordIndex ? [recordIndex] : []), ...engagementBlocks];

  for (const item of oldestFirst) {
    const extract = extractFor.get(item.id);
    const raw = fullText.get(item.id) ?? null;
    const mapped = taskNameFor.get(item.id);
    const headerLines = [
      `  Type: ${item.type} · Source: ${item.source}${item.source_vendor ? ` (${item.source_vendor})` : ""} · Fidelity: ${item.content_fidelity ?? "unknown"}`,
      `  Date: ${isEngagementScope ? datePrecisionLine(item) : effectiveDate(item).slice(0, 10)} · ${mapped ? `Mapped to ${mapped}` : "Unmapped"}${item.visibility === "private" ? " · MARKED PRIVATE" : ""}`,
    ];
    const lines = [`WORK ITEM: ${item.title}`, ...headerLines];
    if (extract) {
      lines.push(...extractLines(extract));
    }
    const blocked = unreadable.get(item.id);
    if (raw) {
      // Unit 2: turns reach the model in plain words it can cite.
      const shown = item.type === "ai_thread" ? naturalTurnLabels(raw) : raw;
      lines.push(`  Full text:\n${shown}`);
      quotableParts.push(shown);
      documents.push(recordDocument(item, raw, headerLines.map((l) => l.trim()).join(" · ")));
      tier2 += 1;
      reads.push({ workItemId: item.id, ownerId, depth: "full" });
      sources.push({
        id: item.id,
        title: item.title,
        type: item.type,
        source_vendor: item.source_vendor,
        depth: "full",
      });
    } else if (blocked) {
      lines.push(unreadableLine(item.type, blocked.note));
      unreadableCount += 1;
      reads.push({ workItemId: item.id, ownerId, depth: "unreadable" });
      sources.push({
        id: item.id,
        title: item.title,
        type: item.type,
        source_vendor: item.source_vendor,
        depth: "unreadable",
      });
    } else {
      lines.push(
        extract ? "  Full text: summary only in this answer." : "  Content: not stored as text.",
      );
      reads.push({ workItemId: item.id, ownerId, depth: "extract" });
      sources.push({
        id: item.id,
        title: item.title,
        type: item.type,
        source_vendor: item.source_vendor,
        depth: "extract",
      });
    }
    parts.push(lines.join("\n"));
    if (!raw) preambleParts.push(lines.join("\n"));
  }

  // IMG-3: board images, read as their stored AI description, after the work.
  const images = options?.briefOnly && !(scope.images && scope.images.length > 0) ? [] : await loadBoardImages(supabase, scope);
  for (const image of images) {
    if (!image.text) continue;
    const title = imageTitle(image.text);
    const block = [`IMAGE ON THE BOARD: ${title}`, `  [${IMAGE_DESCRIPTION_LABEL}]`, `  Description:\n${image.text}`].join("\n");
    parts.push(block);
    // Not quotable: an AI description is not anyone's exact words.
    documents.push({ id: `image:${image.id}`, title, kind: "text", turnNumbers: [], blocks: [image.text], context: IMAGE_DESCRIPTION_LABEL });
  }

  const tier1 = items.length + brief.itemIds.length;
  const extractOnly = tier1 - tier2;

  // The manifest: built from what was assembled above, never from the answer.
  const manifestItems: ManifestItem[] = [];
  const excluded: ManifestExcluded[] = [];
  let readSetCharsTotal = 0;
  let readSetCharsIn = 0;
  let itemsWithText = 0;
  for (const item of oldestFirst) {
    const raw = fullText.get(item.id) ?? null;
    const blocked = unreadable.get(item.id);
    // Fetched items know their exact size; an item the clock or the window
    // kept closed falls back to the size the last read cached on its row.
    const total = charsTotal.get(item.id) ?? (blocked ? 0 : storedCharsHint(item));
    if (raw) {
      const charsIn = raw.includes(OMITTED_MARKER) ? Math.max(0, raw.length - OMITTED_MARKER.length - 4) : total;
      readSetCharsTotal += total;
      readSetCharsIn += Math.min(charsIn, total);
      itemsWithText += 1;
      manifestItems.push({
        id: item.id,
        title: item.title,
        kind: manifestKind(item.type),
        detail: detailFor(item, raw),
        chars_in: Math.min(charsIn, total),
        chars_total: total,
      });
    } else if (blocked) {
      excluded.push({
        title: item.title,
        reason: blocked.note ?? "the stored file could not be read",
      });
    } else {
      // Stored text that did not reach the model: over the window, or out of
      // time. Counted against the share so the proof line cannot flatter.
      if (total > 0) {
        readSetCharsTotal += total;
        itemsWithText += 1;
      }
      manifestItems.push({
        id: item.id,
        title: item.title,
        kind: manifestKind(item.type),
        detail: total > 0 ? "stored text not read, over the window" : extractFor.get(item.id) ? "summary only, full text not opened" : "no stored text",
        chars_in: 0,
        chars_total: total,
      });
    }
  }
  for (const image of images) {
    if (image.text) {
      manifestItems.push({
        id: `image:${image.id}`,
        title: imageTitle(image.text),
        kind: "item",
        detail: "AI description of an image",
        chars_in: image.text.length,
        chars_total: image.text.length,
      });
    } else {
      excluded.push({
        title: "An image on the board",
        reason: image.status === "skipped" ? "this image type or size cannot be read" : image.status === "failed" ? "the image could not be read" : "the image is still being read",
      });
    }
  }
  if (anyCut) {
    excluded.push({
      title: "Part of the longest items",
      reason: "over the context limit, the middle of those items was left out",
    });
  }
  const readSet: ManifestReadSet = {
    ids: items.map((i) => i.id),
    items_with_text: itemsWithText,
    chars_total: readSetCharsTotal,
    chars_in: readSetCharsIn,
    share: readSetCharsTotal > 0 ? Math.round((readSetCharsIn / readSetCharsTotal) * 10000) / 10000 : 1,
  };
  const selection =
    scope.mode === "items" && !options?.pointedAt
      ? await selectionContext(
          supabase,
          ownerId,
          items.map((i) => i.id),
        )
      : scope.mode === "items"
        ? {
            engagement: (
              await selectionContext(
                supabase,
                ownerId,
                items.map((i) => i.id),
              )
            ).engagement,
            excluded: [] as ManifestExcluded[],
          }
        : { engagement: null, excluded: [] as ManifestExcluded[] };
  const scopeEngagement = tasks.find((t) => t.engagements)?.engagements ?? null;
  const manifest: ContextManifest = {
    engagement: scopeEngagement
      ? { id: scopeEngagement.id, name: scopeEngagement.title }
      : selection.engagement,
    brief_included: brief.present,
    firm_checks_applied: 0,
    items: manifestItems,
    excluded: [...excluded, ...selection.excluded],
    assembled_at: new Date().toISOString(),
    read_set: readSet,
  };

  return {
    context: parts.join("\n\n---\n\n") || "(No recorded work in this scope yet.)",
    quotable: quotableParts.filter(Boolean).join("\n\n"),
    truncated: anyCut || extractOnly > 0,
    itemCount: tier1,
    tier1Count: tier1,
    tier2Count: tier2,
    unreadableCount,
    renditionsRead,
    reads,
    sources,
    manifest,
    readSet,
    recordIndex,
    documents,
    preamble: preambleParts.filter(Boolean).join("\n\n---\n\n"),
  };
}

const TURN_SPLIT = /^TURN (\d+) (USER|ASSISTANT|TOOL): /gm;

/**
 * One item as a citable document. A conversation is split on its stored turn
 * tags into one block per turn, labelled in the plain words the model cites
 * ("(turn 5, you said) ..."); a file is one block of text.
 */
export function recordDocument(item: { id: string; title: string; type: string }, raw: string, context: string): RecordDocument {
  if (item.type !== "ai_thread") {
    return { id: item.id, title: item.title, kind: "text", turnNumbers: [], blocks: [raw], context };
  }
  const turnNumbers: number[] = [];
  const blocks: string[] = [];
  const matches = [...raw.matchAll(TURN_SPLIT)];
  if (matches.length === 0) {
    return { id: item.id, title: item.title, kind: "text", turnNumbers: [], blocks: [naturalTurnLabels(raw)], context };
  }
  matches.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1]?.index ?? raw.length) : raw.length;
    const turnText = raw.slice(start, end).trimEnd();
    turnNumbers.push(Number(m[1]));
    blocks.push(naturalTurnLabels(turnText));
  });
  return { id: item.id, title: item.title, kind: "conversation", turnNumbers, blocks, context };
}

/** The size a previous read cached on the row, or 0 when nothing is known. */
export function storedCharsHint(item: { meta?: unknown }): number {
  const meta = (item.meta ?? null) as { text_chars?: unknown; text_status?: unknown } | null;
  if (!meta) return 0;
  const status = typeof meta.text_status === "string" ? meta.text_status : null;
  if (status && status !== "ok") return 0;
  return typeof meta.text_chars === "number" && meta.text_chars > 0 ? meta.text_chars : 0;
}

/**
 * The rows of the record index: every item on the board the scope sits on,
 * with the read set marked. Turn counts are exact (one id-only query); sizes
 * are exact for items that were read and the cached hint otherwise.
 */
export async function loadRecordIndex(
  supabase: Db,
  ownerId: string,
  scope: ContextScope,
  tasks: TaskRow[],
  readSetItems: ItemRow[],
  fullText: Map<string, string>,
  charsTotal: Map<string, number>,
): Promise<IndexRow[]> {
  const inReadSet = new Set(readSetItems.map((i) => i.id));
  const boardId =
    scope.board ??
    (scope.mode === "engagements" && scope.ids.length === 1 ? scope.ids[0] : undefined) ??
    tasks.find((t) => t.engagement_id)?.engagement_id;
  let boardItems: ItemRow[] = readSetItems;
  if (boardId && !(scope.mode === "engagements" && scope.ids.length === 1 && scope.ids[0] === boardId)) {
    try {
      const loaded = await loadScopeData(supabase, ownerId, { mode: "engagements", ids: [boardId] });
      const seen = new Set<string>();
      boardItems = [...loaded.items, ...readSetItems].filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    } catch {
      boardItems = readSetItems;
    }
  }
  if (scope.mode === "whole") boardItems = readSetItems;
  const threadIds = boardItems.filter((i) => i.type === "ai_thread").map((i) => i.id);
  const turnCounts = new Map<string, number>();
  if (threadIds.length > 0) {
    const { data } = await supabase.from("turns").select("work_item_id").in("work_item_id", threadIds);
    for (const row of data ?? []) turnCounts.set(row.work_item_id, (turnCounts.get(row.work_item_id) ?? 0) + 1);
  }
  const rows: IndexRow[] = boardItems.map((item) => {
    const read = fullText.get(item.id);
    const exact = charsTotal.get(item.id);
    const chars = exact ?? (storedCharsHint(item) || null);
    const turns = item.type === "ai_thread" ? turnCounts.get(item.id) ?? (read ? turnNumbersIn(read).length : null) : null;
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      date: effectiveDate(item).slice(0, 10),
      selected: inReadSet.has(item.id),
      turns: turns === 0 && !turnCounts.has(item.id) ? null : turns,
      chars,
      charsExact: exact !== undefined,
    };
  });
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}
