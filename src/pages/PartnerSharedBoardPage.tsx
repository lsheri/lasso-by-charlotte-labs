import { useQuery } from "@tanstack/react-query";

import { WorkNote } from "@/components/work/WorkNote";
import { supabase } from "@/integrations/supabase/client";
import { usePartnerSharedBoards } from "@/hooks/use-partner-shared-boards";
import type { WorkItemRow } from "@/lib/work-types";

export const SHARED_BOARD_COPY = {
  sharedBy: (name: string) =>
    `Shared by ${name}. This board lives in their workspace; you can read what they shared.`,
  ended: "This board is no longer shared with you.",
  empty: "Nothing you can read on this board yet.",
} as const;

async function fetchSharedPieces(boardId: string): Promise<WorkItemRow[]> {
  const { data, error } = await supabase
    .from("work_items")
    .select(
      "id, owner_id, client_id, title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, source_vendor, orig_conversation_id, ungrouped_at, source_meta, meta, work_item_tasks!inner(tasks!inner(engagement_id))",
    )
    .eq("work_item_tasks.tasks.engagement_id", boardId)
    .order("captured_at", { ascending: false });
  if (error) throw error;
  // The join only scopes the read; the card never shows a placement.
  return ((data ?? []) as unknown as WorkItemRow[]).map(
    ({ work_item_tasks: _placement, ...item }) => item as WorkItemRow,
  );
}

/** MN-5: a read-only view of what one person shared with this partner workspace. */
export function PartnerSharedBoardPage({ boardId }: { boardId: string }) {
  const { data: shared, isLoading } = usePartnerSharedBoards();
  const board = (Array.isArray(shared) ? shared : []).find((entry) => entry.board_id === boardId);
  const pieces = useQuery({
    queryKey: ["partner-shared-pieces", boardId],
    queryFn: () => fetchSharedPieces(boardId),
    enabled: Boolean(board),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading</div>;
  if (!board) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-muted-foreground">{SHARED_BOARD_COPY.ended}</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="font-serif text-[26px] text-foreground">{board.title}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{SHARED_BOARD_COPY.sharedBy(board.shared_by)}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(pieces.data ?? []).map((item) => (
          <WorkNote key={item.id} item={item} />
        ))}
      </div>
      {pieces.isSuccess && pieces.data.length === 0 ? (
        <p className="mt-4 text-muted-foreground">{SHARED_BOARD_COPY.empty}</p>
      ) : null}
    </div>
  );
}
