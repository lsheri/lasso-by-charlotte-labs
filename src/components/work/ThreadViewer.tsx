import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DraftDecisionsButton } from "@/components/decisions/DraftDecisionsButton";
import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";

type Turn = { id: string; turn_no: number; role: string; content: string };

export function ThreadViewer({
  item,
  open,
  onOpenChange,
}: {
  item: WorkItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: turns, error } = useQuery({
    queryKey: ["turns", item?.id],
    enabled: Boolean(item && open),
    queryFn: async (): Promise<Turn[]> => {
      const { data, error: turnsError } = await supabase
        .from("turns")
        .select("id, turn_no, role, content")
        .eq("work_item_id", item?.id as string)
        .order("turn_no", { ascending: true });
      if (turnsError) throw turnsError;
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="page-title">{item?.title ?? "Thread"}</DialogTitle>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

        <div className="space-y-5">
          {(turns ?? []).map((turn) =>
            turn.role === "user" ? (
              <div key={turn.id} className="flex flex-col items-end">
                <div className="micro-label mb-1">
                  Turn {turn.turn_no} · {turn.role}
                </div>
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius)] bg-primary px-4 py-3 font-mono text-xs leading-relaxed text-primary-foreground">
                  {turn.content}
                </div>
              </div>
            ) : (
              <div key={turn.id}>
                <div className="micro-label mb-1">
                  Turn {turn.turn_no} · {turn.role}
                </div>
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card px-4 py-3 font-mono text-xs leading-relaxed text-foreground shadow-card">
                  {turn.content}
                </div>
              </div>
            ),
          )}
          {turns && turns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No turns stored for this item.</p>
          ) : null}
        </div>

        {item && item.type === "ai_thread" ? (
          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <DraftDecisionsButton workItemId={item.id} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
