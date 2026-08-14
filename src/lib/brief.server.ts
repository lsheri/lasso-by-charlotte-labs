import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { AiReadInput } from "./ai-reads.server";
import { BRIEF_HEADER, NO_BRIEF_LINE, briefScopeOf, clipBrief } from "./brief-shared";
import { ITEM_TEXT_COLUMNS, getItemText, type TextItem } from "./item-text.server";
import type { ContextScope, ContextSource } from "./reflect-shared";

type Db = SupabaseClient<Database>;

export type BriefContext = {
  /** Always non-empty: either the briefs, or the plain statement that none exists. */
  block: string;
  /** Characters spent on brief text, deducted from the tier 2 raw budget. */
  chars: number;
  present: boolean;
  itemIds: string[];
  reads: AiReadInput[];
  sources: ContextSource[];
};

type BriefRow = TextItem & { source_vendor: string | null };

/** Which engagements and tasks the current scope covers. */
async function scopeIds(
  supabase: Db,
  ownerId: string,
  scope: ContextScope,
): Promise<{ whole: boolean; engagements: Set<string>; tasks: Set<string> }> {
  if (scope.mode === "whole" || scope.ids.length === 0) {
    return { whole: true, engagements: new Set(), tasks: new Set() };
  }

  if (scope.mode === "engagements") {
    const { data } = await supabase
      .from("tasks")
      .select("id")
      .eq("owner_id", ownerId)
      .in("engagement_id", scope.ids);
    return {
      whole: false,
      engagements: new Set(scope.ids),
      tasks: new Set((data ?? []).map((row) => row.id)),
    };
  }

  let taskIds: string[] = [];
  if (scope.mode === "tasks") {
    taskIds = scope.ids;
  } else {
    const { data } = await supabase
      .from("work_item_tasks")
      .select("task_id")
      .in("work_item_id", scope.ids);
    taskIds = Array.from(new Set((data ?? []).map((row) => row.task_id)));
  }
  if (taskIds.length === 0) return { whole: false, engagements: new Set(), tasks: new Set() };

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, engagement_id")
    .eq("owner_id", ownerId)
    .in("id", taskIds);
  return {
    whole: false,
    engagements: new Set((tasks ?? []).map((row) => row.engagement_id)),
    tasks: new Set(taskIds),
  };
}

/**
 * Tier 0. A brief whose scope covers this question is ALWAYS included, ALWAYS
 * in full text, never reduced to an extract, and never dropped by the budget.
 * Read as the caller, so row-level policies still decide what can be read.
 */
export async function loadBriefContext(
  supabase: Db,
  ownerId: string,
  scope: ContextScope,
): Promise<BriefContext> {
  const empty: BriefContext = {
    block: NO_BRIEF_LINE,
    chars: 0,
    present: false,
    itemIds: [],
    reads: [],
    sources: [],
  };

  const { data, error } = await supabase
    .from("work_items")
    .select(`${ITEM_TEXT_COLUMNS}, source_vendor`)
    .eq("owner_id", ownerId)
    .eq("meta->>role", "brief");

  const covers = await scopeIds(supabase, ownerId, scope);
  const briefs = ((error ? [] : ((data ?? []) as unknown as BriefRow[])) as BriefRow[]).filter((row) => {
    const briefScope = briefScopeOf(row.meta);
    if (!briefScope) return false;
    if (covers.whole) return true;
    return briefScope.type === "engagement"
      ? covers.engagements.has(briefScope.id)
      : covers.tasks.has(briefScope.id);
  });
  if (briefs.length === 0) {
    // The brief is not always a document. An engagement can carry it as text
    // on the engagement itself, and that is a brief in every sense that
    // matters to an analysis, so it is read the same way.
    return await engagementBriefContext(supabase, covers.engagements, empty);
  }

  const blocks: string[] = [];
  const reads: AiReadInput[] = [];
  const sources: ContextSource[] = [];
  const itemIds: string[] = [];
  let chars = 0;

  for (const brief of briefs) {
    const result = await getItemText(supabase, brief);
    const text = (result.text ?? "").trim();
    const lines = [`BRIEF DOCUMENT: ${brief.title}`];
    if (text) {
      const clipped = clipBrief(text);
      if (clipped.cut) {
        lines.push(
          "  This brief is very long, so its opening and its closing sections are given in full and the middle is omitted.",
        );
      }
      lines.push(clipped.text);
      chars += clipped.text.length;
    } else {
      lines.push(
        `  CONTENT COULD NOT BE READ (${result.note ?? "scanned or unsupported format"}). You have NOT seen this brief. Do not describe, summarise or quote it.`,
      );
    }
    blocks.push(lines.join("\n"));
    itemIds.push(brief.id);
    // A brief is always read in full, so it is audited as such.
    reads.push({ workItemId: brief.id, ownerId, depth: "full" });
    sources.push({
      id: brief.id,
      title: brief.title,
      type: brief.type,
      source_vendor: brief.source_vendor,
      depth: "full",
    });
  }

  return {
    block: [BRIEF_HEADER, ...blocks].join("\n\n"),
    chars,
    present: true,
    itemIds,
    reads,
    sources,
  };
}

/** Tier 0 fallback: the brief written on the engagement row itself. */
async function engagementBriefContext(
  supabase: Db,
  engagementIds: Set<string>,
  empty: BriefContext,
): Promise<BriefContext> {
  if (engagementIds.size === 0) return empty;
  const { data } = await supabase
    .from("engagements")
    .select("id, title, brief, brief_by")
    .in("id", Array.from(engagementIds));
  const written = (data ?? []).filter((row) => (row.brief ?? "").trim().length > 0);
  if (written.length === 0) return empty;

  const blocks: string[] = [];
  let chars = 0;
  for (const row of written) {
    const clipped = clipBrief((row.brief ?? "").trim());
    chars += clipped.text.length;
    blocks.push(
      [
        `BRIEF FOR THE ENGAGEMENT: ${row.title}`,
        row.brief_by ? `  Written by: ${row.brief_by}` : "",
        clipped.text,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    block: [BRIEF_HEADER, ...blocks].join("\n\n"),
    chars,
    present: true,
    itemIds: [],
    reads: [],
    sources: [],
  };
}
