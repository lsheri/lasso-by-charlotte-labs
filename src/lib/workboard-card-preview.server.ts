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

type PreviewSummaryRow = {
  work_item_id: string;
  summary: string | null;
};

/** One caller-scoped read for every chat card currently visible on the board. */
export async function readWorkboardCardPreviews(db: Db, workItemIds: string[]): Promise<WorkboardCardPreview[]> {
  const ids = [...new Set(workItemIds.filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return [];
  const [turnResult, summaryResult] = await Promise.all([
    db.from("turns").select("work_item_id, turn_no, role, content, model").in("work_item_id", ids).order("turn_no", { ascending: true }),
    db.from("work_item_extracts").select("work_item_id, summary").in("work_item_id", ids),
  ]);
  if (turnResult.error) throw new Error(turnResult.error.message);
  if (summaryResult.error) throw new Error(summaryResult.error.message);

  const grouped = new Map<string, PreviewTurnRow[]>();
  for (const row of (turnResult.data ?? []) as PreviewTurnRow[]) {
    grouped.set(row.work_item_id, [...(grouped.get(row.work_item_id) ?? []), row]);
  }
  const summaries = new Map(((summaryResult.data ?? []) as PreviewSummaryRow[]).map((row) => [row.work_item_id, row.summary]));
  return ids.map((workItemId) => {
    const turns = grouped.get(workItemId) ?? [];
    const last = turns.slice(-3);
    return {
      workItemId,
      summary: summaries.get(workItemId) ?? null,
      turnCount: turns.length,
      model: [...turns].reverse().find((turn) => turn.model)?.model ?? null,
      firstUserTurn: (() => {
        const turn = turns.find((candidate) => candidate.role.trim().toLowerCase() === "user");
        return turn
          ? { turnNo: turn.turn_no, role: turn.role, content: turn.content.slice(0, 400) }
          : null;
      })(),
      turns: last.map((turn) => ({ turnNo: turn.turn_no, role: turn.role, content: turn.content.slice(0, 400) })),
    };
  });
}