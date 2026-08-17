import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  clientDisplayName,
  engagementDisplayCode,
  engagementDisplayTitle,
} from "@/lib/clients";

import type { AiReadInput, AiReadRole } from "./ai-reads.server";
import { loadBriefContext } from "./brief.server";
import {
  manifestKind,
  wordCountLabel,
  type ContextManifest,
  type ManifestExcluded,
  type ManifestItem,
} from "./context-manifest";
import { ensureExtract, type ClassifiableItem } from "./extract.server";
import { ITEM_TEXT_COLUMNS, getItemText, type ItemTextStatus } from "./item-text.server";
import type { ContextScope, ContextSource } from "./reflect-shared";

/** Tier 2 is the expensive tier: raw text, bounded hard. */
const RAW_BUDGET = 120_000;
const PER_ITEM_CHARS = 40_000;
const HEAD_CHARS = 8_000;
const TAIL_CHARS = 32_000;
const OMITTED_MARKER = "[... middle of this item omitted ...]";
/**
 * Backfilling is a side effect of asking a question, so almost none of it
 * happens on the critical path. Two are made to wait; the rest are started
 * and left to finish, and are simply there for the next question.
 */
const MAX_BACKFILL_INLINE = 2;
/** Pulling raw text is I/O plus parsing. Stop spending on it after this. */
const TEXT_BUDGET_MS = 25_000;

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
  reads: AiReadInput[];
  sources: ContextSource[];
  /** Exactly what went into the prompt, for the person to inspect after. */
  manifest: ContextManifest;
};

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

/** Endings carry the decisions, so a cut item keeps its head AND its tail. */
export function headAndTail(text: string, cap = PER_ITEM_CHARS): { text: string; cut: boolean } {
  if (text.length <= cap) return { text, cut: false };
  return {
    text: `${text.slice(0, HEAD_CHARS)}\n\n${OMITTED_MARKER}\n\n${text.slice(-TAIL_CHARS)}`,
    cut: true,
  };
}

export { RAW_BUDGET };

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
): Promise<{ scope: ContextScope; excluded: ManifestExcluded[] }> {
  const { items } = await loadScopeData(supabase, ownerId, sessionScope);
  const inScope = new Map(items.map((i) => [i.id, i.title]));
  const wanted = new Set(pointedIds);
  const allowed = pointedIds.filter((id) => inScope.has(id));
  if (allowed.length === 0) return { scope: sessionScope, excluded: [] };

  const excluded: ManifestExcluded[] = [];
  for (const [id, title] of inScope) {
    if (!wanted.has(id)) excluded.push({ title, reason: "not pointed at for this question" });
  }
  const strays = pointedIds.filter((id) => !inScope.has(id));
  if (strays.length > 0) {
    const { data } = await supabase.from("work_items").select("id, title").in("id", strays);
    for (const row of data ?? []) {
      excluded.push({ title: row.title, reason: "not part of this engagement" });
    }
  }
  return { scope: { mode: "items", ids: allowed }, excluded };
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
  const linkRows = (links.data ?? []) as LinkRow[];

  let itemQuery = supabase
    .from("work_items")
    .select(
      `${ITEM_TEXT_COLUMNS}, source, visibility, captured_at, work_date, created_at_source, content_fidelity, source_vendor`,
    )
    .eq("owner_id", ownerId)
    .order("captured_at", { ascending: false })
    .limit(300);
  if (scope.mode === "items" && scope.ids.length > 0) {
    itemQuery = itemQuery.in("id", scope.ids);
  } else if (scope.mode !== "whole") {
    const ids = linkRows.map((l) => l.work_item_id);
    if (ids.length === 0) itemQuery = itemQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    else itemQuery = itemQuery.in("id", ids);
  }
  const itemsRes = await itemQuery;
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  return { tasks, linkRows, items: (itemsRes.data ?? []) as unknown as ItemRow[] };
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
        `ENGAGEMENT ${engagementDisplayCode(engagement) ?? "(folder)"}: ${engagementDisplayTitle(engagement)}`,
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
export async function assembleReflectContext(
  supabase: Db,
  profileId: string,
  scope: ContextScope,
  options?: { ownerProfileId?: string; readerRole?: AiReadRole; pointedAt?: boolean },
): Promise<AssembledContext> {
  const ownerId = options?.ownerProfileId ?? profileId;

  // 1 to 3. Tasks, mapping links, and the work items themselves.
  const { tasks, linkRows, items: allItems } = await loadScopeData(supabase, ownerId, scope);

  // Tier 0. The brief is loaded first, is never budgeted away, and is removed
  // from the ordinary item list so it cannot also appear as an extract.
  const brief = await loadBriefContext(supabase, ownerId, scope);
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
    const made: string[] = [];
    for (const id of inline) {
      if (await ensureExtract(id)) made.push(id);
    }
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

  // 6. Tier 2 priority: explicitly named items first, then most recent.
  const byNewest = [...items].sort(
    (a, b) => new Date(effectiveDate(b)).getTime() - new Date(effectiveDate(a)).getTime(),
  );
  const named = scope.mode === "items" ? new Set(scope.ids) : new Set<string>();
  const priority = [
    ...byNewest.filter((i) => named.has(i.id)),
    ...byNewest.filter((i) => !named.has(i.id)),
  ];

  const fullText = new Map<string, string>();
  const unreadable = new Map<string, { status: ItemTextStatus; note: string | null }>();
  let rawUsed = 0;
  let anyCut = false;
  const textStarted = Date.now();
  for (const item of priority) {
    // Once the budget or the clock is gone, stop opening files entirely: the
    // remaining items still appear, as their extract.
    if (rawUsed >= rawBudget || Date.now() - textStarted > TEXT_BUDGET_MS) break;
    const result = await getItemText(supabase, item);
    if (result.status === "unsupported" || result.status === "failed") {
      unreadable.set(item.id, { status: result.status, note: result.note ?? null });
      continue;
    }
    if (result.status === "empty" && item.content_ref) {
      unreadable.set(item.id, { status: "empty", note: result.note ?? null });
      continue;
    }
    const text = (result.text ?? "").trim();
    if (!text) continue;
    const clipped = headAndTail(text);
    if (clipped.cut) anyCut = true;
    const remaining = rawBudget - rawUsed;
    if (clipped.text.length > remaining) {
      anyCut = true;
      const room = headAndTail(clipped.text, remaining);
      fullText.set(item.id, room.text);
      rawUsed = rawBudget;
      break;
    }
    fullText.set(item.id, clipped.text);
    rawUsed += clipped.text.length;
  }
  console.log(
    `[reflect-context] text pass: ${fullText.size} full, ${unreadable.size} unreadable, ${Date.now() - textStarted}ms`,
  );

  // 7. Serialize oldest to newest so the record reads as a story.
  const oldestFirst = [...items].sort(
    (a, b) => new Date(effectiveDate(a)).getTime() - new Date(effectiveDate(b)).getTime(),
  );

  // The brief sits above the engagement structure and above every item: long
  // framing material belongs at the top, and a stable prefix caches well.
  const parts: string[] = [brief.block, ...engagementBlocks];
  const reads: AiReadInput[] = [...brief.reads];
  const sources: ContextSource[] = [...brief.sources];
  let tier2 = brief.itemIds.length;
  let unreadableCount = 0;
  // Quotation is a promise of exact wording, so only verbatim text counts.
  const quotableParts: string[] = [brief.block];

  for (const item of oldestFirst) {
    const extract = extractFor.get(item.id);
    const raw = fullText.get(item.id) ?? null;
    const mapped = taskNameFor.get(item.id);
    const lines = [
      `WORK ITEM: ${item.title}`,
      `  Type: ${item.type} · Source: ${item.source}${item.source_vendor ? ` (${item.source_vendor})` : ""} · Fidelity: ${item.content_fidelity ?? "unknown"}`,
      `  Date: ${effectiveDate(item).slice(0, 10)} · ${mapped ? `Mapped to ${mapped}` : "Unmapped"}${item.visibility === "private" ? " · MARKED PRIVATE" : ""}`,
    ];
    if (extract) {
      lines.push(...extractLines(extract));
    }
    const blocked = unreadable.get(item.id);
    if (raw) {
      lines.push(`  Full text:\n${raw}`);
      quotableParts.push(raw);
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
  }

  const tier1 = items.length + brief.itemIds.length;
  const extractOnly = tier1 - tier2;

  // The manifest: built from what was assembled above, never from the answer.
  const manifestItems: ManifestItem[] = [];
  const excluded: ManifestExcluded[] = [];
  for (const item of oldestFirst) {
    const raw = fullText.get(item.id) ?? null;
    const blocked = unreadable.get(item.id);
    if (raw) {
      manifestItems.push({
        id: item.id,
        title: item.title,
        kind: manifestKind(item.type),
        detail: detailFor(item, raw),
      });
    } else if (blocked) {
      excluded.push({
        title: item.title,
        reason: blocked.note ?? "the stored file could not be read",
      });
    } else {
      manifestItems.push({
        id: item.id,
        title: item.title,
        kind: manifestKind(item.type),
        detail: extractFor.get(item.id) ? "summary only, full text not opened" : "no stored text",
      });
    }
  }
  if (anyCut) {
    excluded.push({
      title: "Part of the longest items",
      reason: "over the context limit, the middle of those items was left out",
    });
  }
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
  };

  return {
    context: parts.join("\n\n---\n\n") || "(No recorded work in this scope yet.)",
    quotable: quotableParts.join("\n\n"),
    truncated: anyCut || extractOnly > 0,
    itemCount: tier1,
    tier1Count: tier1,
    tier2Count: tier2,
    unreadableCount,
    reads,
    sources,
    manifest,
  };
}
