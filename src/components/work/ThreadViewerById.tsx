import { useQuery } from "@tanstack/react-query";

import { ThreadViewer } from "@/components/work/ThreadViewer";
import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";

export function ThreadViewerById({
  workItemId,
  onClose,
}: {
  workItemId: string | null;
  onClose: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["work-item", workItemId],
    enabled: Boolean(workItemId),
    queryFn: async (): Promise<WorkItemRow | null> => {
      const { data: row, error } = await supabase
        .from("work_items")
        .select("id, title, type, source, visibility, captured_at, content_ref, meta")
        .eq("id", workItemId as string)
        .maybeSingle();
      if (error) throw error;
      return row
        ? ({ ...row, meta: (row.meta ?? null), work_item_tasks: [] } as unknown as WorkItemRow)
        : null;
    },
  });

  return (
    <ThreadViewer
      item={data ?? null}
      open={Boolean(workItemId)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    />
  );
}
