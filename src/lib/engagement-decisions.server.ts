import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { ITEM_TEXT_COLUMNS, ensureExtract, pullItemText } from "./extract.server";
import type { ClassifiableItem } from "./extract.server";
import { loadBriefContext } from "./brief.server";

type Db = SupabaseClient<Database>;

/** Raw text is the expensive part, so the map is extracts and the text is bounded. */
const RAW_BUDGET = 80_000;
const PER_ITEM = 20_000;
/** Deliverables get read in full first: that is where a decision landed. */
const DELIVERABLE_BUDGET = 120_000;
const DELIVERABLE_PER_ITEM = 40_000;
const DELIVERABLE_TYPES = new Set(["document", "deck", "sheet"]);
const MAX_BACKFILL = 8;

export type EngagementSource = { no: number; id: string; title: string };

export type EngagementCorpus = {
  prompt: string;
  sources: EngagementSource[];
};

type Row = ClassifiableItem & { visibility: string; captured_at: string; work_date: string | null };

/**
 * Everything mapped into one engagement, as one prompt: the brief and tasks as
 * the frame, an extract for every item so nothing is invisible, and raw text
 * for as much as the budget allows. Read as the caller, so policies decide.
 */
export async function buildEngagementCorpus(
  supabase: Db,
  engagementId: string,
  ownerId: string,
): Promise<EngagementCorpus> {
  const { data: engagement } = await supabase
    .from("engagements")
    .select("code, title, client_label, brief, term_label, outcome")
    .eq("id", engagementId)
    .maybeSingle();

  // Tier 0: the marked brief, in full, above everything else.
  const briefContext = await loadBriefContext(supabase, ownerId, {
    mode: "engagements",
    ids: [engagementId],
  });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, name, goal, detail, status, position")
    .eq("engagement_id", engagementId)
    .eq("owner_id", ownerId)
    .order("position", { ascending: true });

  const taskRows = tasks ?? [];
  const { data: links } = taskRows.length
    ? await supabase
        .from("work_item_tasks")
        .select("work_item_id, task_id, step_no")
        .in(
          "task_id",
          taskRows.map((t) => t.id),
        )
    : { data: [] };

  const linkRows = (links ?? []) as {
    work_item_id: string;
    task_id: string;
    step_no: number | null;
  }[];
  const itemIds = Array.from(new Set(linkRows.map((l) => l.work_item_id)));

  const { data: itemData } = itemIds.length
    ? await supabase
        .from("work_items")
        .select(`${ITEM_TEXT_COLUMNS}, visibility, captured_at, work_date`)
        .in("id", itemIds)
        .eq("owner_id", ownerId)
    : { data: [] };
  const items = ((itemData ?? []) as unknown as Row[]).sort(
    (a, b) =>
      new Date(a.work_date ?? a.captured_at).getTime() -
      new Date(b.work_date ?? b.captured_at).getTime(),
  );

  const missing: string[] = [];
  const { data: extractData } = items.length
    ? await supabase
        .from("work_item_extracts")
        .select("work_item_id, summary, decisions")
        .in(
          "work_item_id",
          items.map((i) => i.id),
        )
    : { data: [] };
  let extracts = (extractData ?? []) as {
    work_item_id: string;
    summary: string;
    decisions: string | null;
  }[];
  const have = new Set(extracts.map((e) => e.work_item_id));
  for (const item of items)
    if (!have.has(item.id) && missing.length < MAX_BACKFILL) missing.push(item.id);
  if (missing.length > 0) {
    const made: string[] = [];
    for (const id of missing) if (await ensureExtract(id)) made.push(id);
    if (made.length > 0) {
      const { data: more } = await supabase
        .from("work_item_extracts")
        .select("work_item_id, summary, decisions")
        .in("work_item_id", made);
      extracts = [...extracts, ...((more ?? []) as typeof extracts)];
    }
  }
  const extractFor = new Map(extracts.map((e) => [e.work_item_id, e]));

  // A confirmed link marks its target as a deliverable that other work fed
  // into, so those get read first and most generously.
  const { data: deliverableLinks } = items.length
    ? await supabase
        .from("work_item_links")
        .select("to_item_id, status")
        .eq("status", "confirmed")
        .in(
          "to_item_id",
          items.map((i) => i.id),
        )
    : { data: [] };
  const linkedTargets = new Set(
    ((deliverableLinks ?? []) as unknown as { to_item_id: string }[]).map((r) => r.to_item_id),
  );
  const isDeliverable = (item: Row) => DELIVERABLE_TYPES.has(item.type as string);
  const readOrder = [...items].sort((a, b) => {
    const rank = (item: Row) =>
      linkedTargets.has(item.id) && isDeliverable(item) ? 0 : isDeliverable(item) ? 1 : 2;
    return rank(a) - rank(b);
  });

  const taskFor = new Map<string, string>();
  for (const link of linkRows) {
    const task = taskRows.find((t) => t.id === link.task_id);
    if (task) taskFor.set(link.work_item_id, task.name);
  }

  const header = [
    `ENGAGEMENT ${engagement?.code ?? ""}: ${engagement?.title ?? ""}`,
    engagement?.client_label ? `Client context: ${engagement.client_label}` : null,
    engagement?.term_label ? `Term: ${engagement.term_label}` : null,
    engagement?.brief ? `Brief: ${engagement.brief}` : null,
    engagement?.outcome ? `Outcome: ${engagement.outcome}` : null,
    "",
    "TASKS:",
    ...taskRows.map(
      (t) =>
        `  ${t.name} (status ${t.status})${t.goal ? ` Goal: ${t.goal}` : ""}${t.detail ? ` Detail: ${t.detail}` : ""}`,
    ),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const sources: EngagementSource[] = [];
  const blockFor = new Map<string, string>();
  const numberFor = new Map<string, number>();
  let used = 0;
  let deliverableUsed = 0;
  let no = 0;

  // Numbering follows the timeline the reader sees; reading order follows
  // priority, so the budget lands on deliverables first.
  for (const item of items) {
    no += 1;
    numberFor.set(item.id, no);
    sources.push({ no, id: item.id, title: item.title });
  }

  for (const item of readOrder) {
    const itemNo = numberFor.get(item.id)!;
    const extract = extractFor.get(item.id);
    const deliverable = isDeliverable(item);
    const lines = [
      `ITEM ${itemNo}: ${item.title}`,
      `  Type: ${item.type}${deliverable ? " · DELIVERABLE" : ""}${linkedTargets.has(item.id) ? " · other work fed into this" : ""} · Task: ${taskFor.get(item.id) ?? "unmapped"}${item.visibility === "private" ? " · MARKED PRIVATE" : ""}`,
    ];
    if (extract) {
      lines.push(`  Summary: ${extract.summary}`);
      if (extract.decisions) lines.push(`  Decided: ${extract.decisions}`);
    }
    const budget = deliverable ? DELIVERABLE_BUDGET : RAW_BUDGET;
    const spent = deliverable ? deliverableUsed : used;
    if (spent < budget) {
      const text = (await pullItemText(supabase, item)).trim();
      if (text) {
        const room = Math.min(deliverable ? DELIVERABLE_PER_ITEM : PER_ITEM, budget - spent);
        const clipped =
          text.length > room ? `${text.slice(0, room)}\n[... rest omitted ...]` : text;
        if (deliverable) deliverableUsed += clipped.length;
        else used += clipped.length;
        lines.push(`  Text:\n${clipped}`);
      }
    }
    blockFor.set(item.id, lines.join("\n"));
  }

  const blocks = items.map((item) => blockFor.get(item.id)!).filter(Boolean);

  return {
    prompt: [briefContext.block, header, ...blocks].join("\n\n---\n\n"),
    sources,
  };
}
