import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { ITEM_TEXT_COLUMNS, ensureExtract, pullItemText } from "./extract.server";
import type { ClassifiableItem } from "./extract.server";
import {
  LINEAGE_RELATIONS,
  LINEAGE_SYSTEM_PROMPT,
  LINEAGE_TOOL,
  MAX_CANDIDATES,
  type DraftedLink,
  type LineageRelation,
} from "./lineage-shared";

type Db = SupabaseClient<Database>;

const DELIVERABLE_TEXT_BUDGET = 30_000;
const CANDIDATE_TEXT_BUDGET = 24_000;
const PER_CANDIDATE_TEXT = 4_000;
const MAX_BACKFILL = 6;

type Row = ClassifiableItem & {
  visibility: string;
  captured_at: string;
  work_date: string | null;
  created_at_source: string | null;
};

const ROW_COLUMNS = `${ITEM_TEXT_COLUMNS}, visibility, captured_at, work_date, created_at_source`;

function itemDate(row: Row): string {
  return row.work_date ?? row.created_at_source ?? row.captured_at;
}

/** Every item mapped into the engagements this deliverable belongs to. */
async function engagementIdsFor(supabase: Db, workItemId: string): Promise<string[]> {
  const { data } = await supabase
    .from("work_item_tasks")
    .select("tasks(engagement_id)")
    .eq("work_item_id", workItemId);
  return Array.from(
    new Set(
      ((data ?? []) as unknown as { tasks: { engagement_id: string } | null }[])
        .map((row) => row.tasks?.engagement_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

async function candidateIds(
  supabase: Db,
  engagementIds: string[],
  ownerId: string,
): Promise<string[]> {
  if (engagementIds.length === 0) return [];
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id")
    .in("engagement_id", engagementIds)
    .eq("owner_id", ownerId);
  const taskIds = (tasks ?? []).map((t) => t.id);
  if (taskIds.length === 0) return [];
  const { data: links } = await supabase
    .from("work_item_tasks")
    .select("work_item_id")
    .in("task_id", taskIds);
  return Array.from(new Set((links ?? []).map((l) => l.work_item_id)));
}

export type LineageRunResult = {
  drafted: number;
  considered: number;
  skippedExisting: number;
  usage?: { tokensIn: number; costUsd: number };
};

/**
 * Draft "what fed this" for one deliverable. Draft status only. Pairs that
 * already exist in any status are never re-proposed, and the unique index is
 * used with ignoreDuplicates so two concurrent runs cannot double-write.
 */
export async function draftLineageFor(
  supabase: Db,
  args: {
    deliverableId: string;
    ownerId: string;
    orgId: string;
    runnerProfileId: string;
    runnerUserId?: string | null | undefined;
    coachMayRun: boolean;
  },
): Promise<LineageRunResult> {
  const { data: deliverableRow } = await supabase
    .from("work_items")
    .select(ROW_COLUMNS)
    .eq("id", args.deliverableId)
    .eq("owner_id", args.ownerId)
    .maybeSingle();
  const deliverable = deliverableRow as unknown as Row | null;
  if (!deliverable) return { drafted: 0, considered: 0, skippedExisting: 0 };

  const engagementIds = await engagementIdsFor(supabase, args.deliverableId);
  const ids = (await candidateIds(supabase, engagementIds, args.ownerId)).filter(
    (id) => id !== args.deliverableId,
  );
  if (ids.length === 0) return { drafted: 0, considered: 0, skippedExisting: 0 };

  // Any existing row, in any status, means the owner has already been asked.
  const { data: existing } = await supabase
    .from("work_item_links")
    .select("from_item_id")
    .eq("to_item_id", args.deliverableId);
  const already = new Set((existing ?? []).map((row) => row.from_item_id));

  const { data: itemData } = await supabase
    .from("work_items")
    .select(ROW_COLUMNS)
    .in("id", ids)
    .eq("owner_id", args.ownerId);

  const fresh = ((itemData ?? []) as unknown as Row[]).filter((row) => !already.has(row.id));
  const skippedExisting = (itemData ?? []).length - fresh.length;

  // Nearest in time to the deliverable first, then cap. Order is a shortlisting
  // heuristic only; it never becomes evidence for a link.
  const anchor = new Date(itemDate(deliverable)).getTime();
  const candidates = fresh
    .sort(
      (a, b) =>
        Math.abs(new Date(itemDate(a)).getTime() - anchor) -
        Math.abs(new Date(itemDate(b)).getTime() - anchor),
    )
    .slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return { drafted: 0, considered: 0, skippedExisting };
  }

  const { data: extractData } = await supabase
    .from("work_item_extracts")
    .select("work_item_id, summary, decisions, entities, handoff")
    .in(
      "work_item_id",
      candidates.map((c) => c.id),
    );
  let extracts = (extractData ?? []) as {
    work_item_id: string;
    summary: string;
    decisions: string | null;
    entities: string | null;
    handoff: string | null;
  }[];
  const have = new Set(extracts.map((e) => e.work_item_id));
  const missing = candidates.filter((c) => !have.has(c.id)).slice(0, MAX_BACKFILL);
  if (missing.length > 0) {
    const made: string[] = [];
    for (const item of missing) if (await ensureExtract(item.id)) made.push(item.id);
    if (made.length > 0) {
      const { data: more } = await supabase
        .from("work_item_extracts")
        .select("work_item_id, summary, decisions, entities, handoff")
        .in("work_item_id", made);
      extracts = [...extracts, ...((more ?? []) as typeof extracts)];
    }
  }
  const extractFor = new Map(extracts.map((e) => [e.work_item_id, e]));

  const deliverableText = (await pullItemText(supabase, deliverable)).slice(
    0,
    DELIVERABLE_TEXT_BUDGET,
  );

  const blocks: string[] = [];
  const numberFor = new Map<number, string>();
  let used = 0;
  let no = 0;
  for (const candidate of candidates) {
    no += 1;
    numberFor.set(no, candidate.id);
    const extract = extractFor.get(candidate.id);
    const lines = [
      `ITEM ${no}: ${candidate.title}`,
      `  Type: ${candidate.type} · Date: ${itemDate(candidate).slice(0, 10)}`,
    ];
    if (extract) {
      lines.push(`  Summary: ${extract.summary}`);
      if (extract.decisions) lines.push(`  Decided: ${extract.decisions}`);
      if (extract.entities) lines.push(`  Mentions: ${extract.entities}`);
      if (extract.handoff) lines.push(`  Led to: ${extract.handoff}`);
    }
    if (used < CANDIDATE_TEXT_BUDGET) {
      const text = (await pullItemText(supabase, candidate)).trim();
      if (text) {
        const room = Math.min(PER_CANDIDATE_TEXT, CANDIDATE_TEXT_BUDGET - used);
        const clipped =
          text.length > room ? `${text.slice(0, room)}\n[... rest omitted ...]` : text;
        used += clipped.length;
        lines.push(`  Text:\n${clipped}`);
      }
    }
    blocks.push(lines.join("\n"));
  }

  const prompt = [
    `THE DELIVERABLE: ${deliverable.title}`,
    `Type: ${deliverable.type} · Date: ${itemDate(deliverable).slice(0, 10)}`,
    deliverableText ? `Text:\n${deliverableText}` : "Text: not readable as text.",
    "",
    "CANDIDATE ITEMS FROM THE SAME ENGAGEMENT:",
    ...blocks,
  ].join("\n\n---\n\n");

  const { chatComplete, orgNameFor } = await import("./ai.server");
  const completion = await chatComplete(
    [
      { role: "system", content: LINEAGE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    {
      tier: "fast",
      maxTokens: 3000,
      tools: [LINEAGE_TOOL],
      toolChoice: { type: "function", function: { name: "record_links" } },
      meta: {
        surface: "lineage_draft",
        orgId: args.orgId,
        orgName: await orgNameFor(supabase, args.orgId),
      },
    },
  );

  const rawArgs = completion.toolArgs;
  let drafts: DraftedLink[] = [];
  if (rawArgs) {
    try {
      const parsed = JSON.parse(rawArgs) as { links?: DraftedLink[] };
      drafts = Array.isArray(parsed.links) ? parsed.links : [];
    } catch {
      drafts = [];
    }
  }

  const seenPairs = new Set<string>();
  const rows = drafts
    .map((draft) => {
      const fromId = numberFor.get(Number(draft.candidate_no));
      const relation = String(draft.relation) as LineageRelation;
      const rationale = typeof draft.rationale === "string" ? draft.rationale.trim() : "";
      if (!fromId || fromId === args.deliverableId) return null;
      if (!LINEAGE_RELATIONS.includes(relation)) return null;
      if (!rationale) return null;
      const key = `${fromId}:${relation}`;
      if (seenPairs.has(key)) return null;
      seenPairs.add(key);
      return {
        from_item_id: fromId,
        to_item_id: args.deliverableId,
        owner_id: args.ownerId,
        org_id: args.orgId,
        relation,
        rationale: rationale.slice(0, 400),
        status: "draft" as const,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const usage = { tokensIn: completion.tokensIn, costUsd: completion.costUsd };

  if (rows.length === 0) {
    return { drafted: 0, considered: candidates.length, skippedExisting, usage };
  }

  const runnerIsOwner = args.runnerProfileId === args.ownerId;
  let coachCanSeeDeliverable = false;
  if (!runnerIsOwner && args.coachMayRun) {
    const { data, error } = await supabase.rpc("coach_can_see_item", {
      item: args.deliverableId,
    });
    if (error) throw new Error("lineage_authorization_failed");
    coachCanSeeDeliverable = data === true;
  }
  if (!(runnerIsOwner || (args.coachMayRun && coachCanSeeDeliverable))) {
    throw new Error("lineage_not_authorized");
  }

  // ignoreDuplicates: a second concurrent run silently no-ops instead of
  // surfacing a unique violation to the person.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inserted, error } = await supabaseAdmin
    .from("work_item_links")
    .upsert(rows, { onConflict: "from_item_id,to_item_id,relation", ignoreDuplicates: true })
    .select("id, from_item_id, to_item_id");
  if (error) throw new Error(error.message);

  // Pass 148. A new chain link is a handoff: which tool fed which, and into
  // what kind of thing. Tools and kinds only, never titles.
  if ((inserted ?? []).length > 0) {
    const involved = Array.from(
      new Set((inserted ?? []).flatMap((row) => [row.from_item_id, row.to_item_id])),
    );
    const { data: ends } = await supabaseAdmin
      .from("work_items")
      .select("id, type, source, source_vendor, source_meta, meta")
      .in("id", involved);
    const byId = new Map((ends ?? []).map((row) => [row.id, row]));
    const { noteHandoffObserved } = await import("./work-taxonomy.server");
    for (const link of inserted ?? []) {
      await noteHandoffObserved(
        supabaseAdmin,
        { orgId: args.orgId, userId: args.runnerUserId ?? null, profileId: args.runnerProfileId },
        {
          from: (byId.get(link.from_item_id) ?? null) as never,
          to: (byId.get(link.to_item_id) ?? null) as never,
        },
      );
    }
  }

  return {
    drafted: (inserted ?? []).length,
    considered: candidates.length,
    skippedExisting,
    usage,
  };
}
