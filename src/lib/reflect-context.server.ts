import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { ContextScope } from "./reflect-shared";

/** Roughly a few hundred thousand characters fits comfortably in the model's
 * window; beyond it we drop the oldest items rather than fail the turn. */
const CHAR_BUDGET = 300_000;
const PER_ITEM_CHARS = 40_000;
const TEXTUAL = /\.(txt|md|markdown|json|csv|html?|ya?ml|log)$/i;

type Db = SupabaseClient<Database>;

type ItemRow = {
  id: string;
  title: string;
  type: string;
  source: string;
  visibility: string;
  captured_at: string;
  work_date: string | null;
  created_at_source: string | null;
  content_ref: string | null;
  content_fidelity: string | null;
  source_vendor: string | null;
};

function effectiveDate(item: ItemRow): string {
  return item.work_date ?? item.created_at_source ?? item.captured_at;
}

async function readDocumentText(contentRef: string): Promise<string | null> {
  if (!TEXTUAL.test(contentRef)) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from("work-files").download(contentRef);
    if (error || !data) return null;
    const text = await data.text();
    return text.slice(0, PER_ITEM_CHARS);
  } catch {
    return null;
  }
}

/**
 * Builds the structured record the model reasons over. Everything is read as
 * the owner, so row-level policies decide what can be assembled at all.
 */
export async function assembleReflectContext(
  supabase: Db,
  profileId: string,
  scope: ContextScope,
): Promise<{ context: string; truncated: boolean; itemCount: number }> {
  // 1. Which tasks are in scope (and, through them, which engagements).
  let taskQuery = supabase
    .from("tasks")
    .select(
      "id, name, goal, detail, when_label, status, position, engagement_id, engagements(id, code, title, client_label, brief, term_label, outcome)",
    )
    .eq("owner_id", profileId);
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
      "id, title, type, source, visibility, captured_at, work_date, created_at_source, content_ref, content_fidelity, source_vendor",
    )
    .eq("owner_id", profileId)
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

  // 4. Content: transcripts for threads, text for document-shaped files.
  const turnsRes = items.length
    ? await supabase
        .from("turns")
        .select("work_item_id, turn_no, role, content")
        .in(
          "work_item_id",
          items.map((i) => i.id),
        )
        .order("turn_no", { ascending: true })
    : { data: [], error: null };
  if (turnsRes.error) throw new Error(turnsRes.error.message);
  const turnsByItem = new Map<string, string[]>();
  for (const turn of (turnsRes.data ?? []) as {
    work_item_id: string;
    role: string;
    content: string;
  }[]) {
    const list = turnsByItem.get(turn.work_item_id) ?? [];
    list.push(`${turn.role.toUpperCase()}: ${turn.content}`);
    turnsByItem.set(turn.work_item_id, list);
  }

  // 5. Serialize newest-first and stop when the budget runs out.
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
        `    TASK: ${t.name}${t.when_label ? ` (${t.when_label})` : ""} — status ${t.status}`,
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

  const parts: string[] = [];
  let used = 0;
  let truncated = false;

  for (const block of engagementBlocks.values()) {
    if (used + block.length > CHAR_BUDGET) {
      truncated = true;
      break;
    }
    parts.push(block);
    used += block.length;
  }

  const ordered = [...items].sort(
    (a, b) => new Date(effectiveDate(b)).getTime() - new Date(effectiveDate(a)).getTime(),
  );

  let included = 0;
  for (const item of ordered) {
    const turns = turnsByItem.get(item.id);
    let body = turns ? turns.join("\n\n").slice(0, PER_ITEM_CHARS) : "";
    if (!body && item.content_ref) body = (await readDocumentText(item.content_ref)) ?? "";
    const mapped = taskNameFor.get(item.id);
    const block = [
      `WORK ITEM: ${item.title}`,
      `  Type: ${item.type} · Source: ${item.source}${item.source_vendor ? ` (${item.source_vendor})` : ""} · Fidelity: ${item.content_fidelity ?? "unknown"}`,
      `  Date: ${effectiveDate(item).slice(0, 10)} · ${mapped ? `Mapped to ${mapped}` : "Unmapped"}${item.visibility === "private" ? " · MARKED PRIVATE" : ""}`,
      body ? `  Content:\n${body}` : "  Content: not stored as text.",
    ].join("\n");

    if (used + block.length > CHAR_BUDGET) {
      truncated = true;
      break;
    }
    parts.push(block);
    used += block.length;
    included += 1;
  }

  return {
    context: parts.join("\n\n---\n\n") || "(No recorded work in this scope yet.)",
    truncated,
    itemCount: included,
  };
}
