import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { WorkboardCardPreview } from "@/lib/workboard-card-preview.shared";

type Db = SupabaseClient<Database>;

type PreviewTurnRow = {
  work_item_id: string;
  turn_no: number;
  role: string;
  content: string;
  model: string | null;
};

/** One caller-scoped read for every chat card currently visible on the board. */
export async function readWorkboardCardPreviews(db: Db, workItemIds: string[]): Promise<WorkboardCardPreview[]> {
  const ids = [...new Set(workItemIds.filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return [];
  const queries = ids.map((workItemId) => db
    .from("turns")
    .select("work_item_id, turn_no, role, content, model")
    .eq("work_item_id", workItemId)
    .order("turn_no", { ascending: false })
    .limit(3));
  const results = await Promise.all(queries);
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  const data = results.flatMap((result) => (result.data ?? []) as PreviewTurnRow[]);

  const grouped = new Map<string, PreviewTurnRow[]>();
  for (const row of (data ?? []) as PreviewTurnRow[]) {
    grouped.set(row.work_item_id, [...(grouped.get(row.work_item_id) ?? []), row]);
  }
  return ids.map((workItemId) => {
    const turns = [...(grouped.get(workItemId) ?? [])].sort((a, b) => a.turn_no - b.turn_no);
    const last = turns.slice(-3);
    return {
      workItemId,
      turnCount: Number((last.at(-1) as (PreviewTurnRow & { total_count?: number }) | undefined)?.total_count ?? turns.length),
      model: [...turns].reverse().find((turn) => turn.model)?.model ?? null,
      turns: last.map((turn) => ({ turnNo: turn.turn_no, role: turn.role, content: turn.content })),
    };
  });
}