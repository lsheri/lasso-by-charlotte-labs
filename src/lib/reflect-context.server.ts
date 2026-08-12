import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { AiReadInput, AiReadRole } from "./ai-reads.server";
import {
  ITEM_TEXT_COLUMNS,
  ensureExtract,
  pullItemText,
  type ClassifiableItem,
} from "./extract.server";
import type { ContextScope } from "./reflect-shared";

/** Tier 2 is the expensive tier: raw text, bounded hard. */
const RAW_BUDGET = 120_000;
const PER_ITEM_CHARS = 40_000;
const HEAD_CHARS = 8_000;
const TAIL_CHARS = 32_000;
const OMITTED_MARKER = "[... middle of this item omitted ...]";
/** Backfilling is a side effect of asking a question; keep it small. */
const MAX_BACKFILL_PER_REQUEST = 8;

type Db = SupabaseClient<Database>;

type ItemRow = ClassifiableItem & {
  title: string;
  source: string;
  visibility: string;
  captured_at: string;
  work_date: string | null;
  created_at_source: string | null;
  content_fidelity: string | null;
  source_vendor: string | null;
};

export type AssembledContext = {
  context: string;
  truncated: boolean;
  itemCount: number;
  tier1Count: number;
  tier2Count: number;
  reads: AiReadInput[];
};

function effectiveDate(item: ItemRow): string {
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
  options?: { ownerProfileId?: string; readerRole?: AiReadRole },
): Promise<AssembledContext> {
  const ownerId = options?.ownerProfileId ?? profileId;

  // 1. Which tasks are in scope (and, through them, which engagements).
  let taskQuery = supabase
    .from("tasks")
    .select(
      "id, name, goal, detail, when_label, status, position, engagement_id, engagements(id, code, title, client_label, brief, term_label, outcome)",
    )
    .eq("owner_id", ownerId);
  if (scope.mode === "engagements" && scope.ids.length > 0) {
    taskQuery = taskQuery.in("engagement_id", scope.ids);
  } else if (scope.mode === "tasks" && scope.ids.length > 0) {
    taskQuery = taskQuery.in("id", scope.ids);
  }
  const tasksRes = scope.mode === "items" ? { data: [], error: null } : await taskQuery;
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  const tasks = (tasksRes.data ?? []) as unknown as {
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
    } | null;
  }[];

  // 2. Mapping links, in confirmed step order.
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
  const linkRows = (links.data ?? []) as {
    work_item_id: string;
    task_id: string;
    step_no: number | null;
    step_confirmed: boolean;
  }[];

  // 3. The work items themselves.
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
  const items = (itemsRes.data ?? []) as unknown as ItemRow[];

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

  // 4. Extracts for every in-scope item, backfilling a few that are missing.
  type ExtractRow = {
    work_item_id: string;
    summary: string;
    decisions: string | null;
    entities: string | null;
    handoff: string | null;
  };
  const extractColumns = "work_item_id, summary, decisions, entities, handoff";
  async function readExtracts(ids: string[]): Promise<ExtractRow[]> {
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("work_item_extracts")
      .select(extractColumns)
      .in("work_item_id", ids);
    return (data ?? []) as ExtractRow[];
  }

  const allIds = items.map((i) => i.id);
  let extractRows = await readExtracts(allIds);
  const have = new Set(extractRows.map((row) => row.work_item_id));
  const missing = allIds.filter((id) => !have.has(id)).slice(0, MAX_BACKFILL_PER_REQUEST);
  if (missing.length > 0) {
    const made: string[] = [];
    for (const id of missing) {
      if (await ensureExtract(id)) made.push(id);
    }
    if (made.length > 0) extractRows = [...extractRows, ...(await readExtracts(made))];
  }
  const extractFor = new Map(extractRows.map((row) => [row.work_item_id, row]));

  // 5. Structure block, unchanged in shape.
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
        `    TASK: ${t.name}${t.when_label ? ` (${t.when_label})` : ""}, status ${t.status}`,
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
        `ENGAGEMENT ${engagement.code}: ${engagement.title}`,
        engagement.client_label ? `  Client/context: ${engagement.client_label}` : null,
        engagement.term_label ? `  Term: ${engagement.term_label}` : null,
        engagement.brief ? `  Brief: ${engagement.brief}` : null,
        engagement.outcome ? `  Outcome: ${engagement.outcome}` : null,
        ...taskLines,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

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
  let rawUsed = 0;
  let anyCut = false;
  for (const item of priority) {
    if (rawUsed >= RAW_BUDGET) break;
    const text = (await pullItemText(supabase, item)).trim();
    if (!text) continue;
    const clipped = headAndTail(text);
    if (clipped.cut) anyCut = true;
    const remaining = RAW_BUDGET - rawUsed;
    if (clipped.text.length > remaining) {
      anyCut = true;
      const room = headAndTail(clipped.text, remaining);
      fullText.set(item.id, room.text);
      rawUsed = RAW_BUDGET;
      break;
    }
    fullText.set(item.id, clipped.text);
    rawUsed += clipped.text.length;
  }

  // 7. Serialize oldest to newest so the record reads as a story.
  const oldestFirst = [...items].sort(
    (a, b) => new Date(effectiveDate(a)).getTime() - new Date(effectiveDate(b)).getTime(),
  );

  const parts: string[] = [...engagementBlocks.values()];
  const reads: AiReadInput[] = [];
  let tier2 = 0;

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
      lines.push(`  Summary: ${extract.summary}`);
      if (extract.decisions) lines.push(`  Decided: ${extract.decisions}`);
      if (extract.entities) lines.push(`  Key names and topics: ${extract.entities}`);
      if (extract.handoff) lines.push(`  Led to: ${extract.handoff}`);
    }
    if (raw) {
      lines.push(`  Full text:\n${raw}`);
      tier2 += 1;
      reads.push({ workItemId: item.id, ownerId, depth: "full" });
    } else {
      lines.push(
        extract ? "  Full text: summary only in this answer." : "  Content: not stored as text.",
      );
      reads.push({ workItemId: item.id, ownerId, depth: "extract" });
    }
    parts.push(lines.join("\n"));
  }

  const tier1 = items.length;
  const extractOnly = tier1 - tier2;

  return {
    context: parts.join("\n\n---\n\n") || "(No recorded work in this scope yet.)",
    truncated: anyCut || extractOnly > 0,
    itemCount: tier1,
    tier1Count: tier1,
    tier2Count: tier2,
    reads,
  };
}
