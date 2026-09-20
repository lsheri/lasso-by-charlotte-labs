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
  const { data, error } = await db.rpc("workboard_card_previews" as never, { p_work_item_ids: ids } as never) as unknown as {
    data: PreviewTurnRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);

  const grouped = new Map<string, PreviewTurnRow[]>();
  for (const row of (data ?? []) as PreviewTurnRow[]) {
    grouped.set(row.work_item_id, [...(grouped.get(row.work_item_id) ?? []), row]);
  }
  return ids.map((workItemId) => {
    const turns = grouped.get(workItemId) ?? [];
    const last = turns.slice(-3);
    return {
      workItemId,
      turnCount: turns.length,
      model: [...turns].reverse().find((turn) => turn.model)?.model ?? null,
      turns: last.map((turn) => ({ turnNo: turn.turn_no, role: turn.role, content: turn.content })),
    };
  });
}