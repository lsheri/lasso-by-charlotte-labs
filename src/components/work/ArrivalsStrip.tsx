import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SourceMark } from "@/components/work/SourceMark";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import {
  ARRIVAL_LIMIT,
  arrivalPlace,
  arrivalWhen,
  selectArrivals,
} from "@/lib/inbox-arrivals";
import {
  entryHead,
  entryItems,
  entryKey,
  groupConversations,
  isConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";

/**
 * A quiet group at the top of the Inbox: what the connector brought in over the
 * last seven days and where each piece sits now. Nothing is stored; rows fall
 * out of the strip on their own once they are older than the window.
 *
 * P1: one pushed conversation is one row. The transcript names it and the
 * artifacts that came with it are counted rather than repeated.
 */
export function ArrivalsStrip({ items }: { items: WorkItemRow[] }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const arrivals = groupConversations(selectArrivals(items, profile?.id));
  if (arrivals.length === 0) return null;
  const rows = showAll ? arrivals : arrivals.slice(0, ARRIVAL_LIMIT);

  async function putBack(pieces: WorkItemRow[], taskId: string) {
    for (const piece of pieces) {
      const link = await supabase
        .from("work_item_tasks")
        .insert({ work_item_id: piece.id, task_id: taskId });
      if (link.error) {
        toast.error(link.error.message);
        return;
      }
    }
    if (profile) logEvent("inbox.arrival_undone", profile.org_id, { reverted: true });
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  }

  async function undo(pieces: WorkItemRow[], key: string, taskId: string) {
    setBusy(key);
    try {
      for (const piece of pieces) {
        const gone = await supabase.from("work_item_tasks").delete().eq("work_item_id", piece.id);
        if (gone.error) {
          toast.error(gone.error.message);
          return;
        }
      }
      if (profile) logEvent("inbox.arrival_undone", profile.org_id, { reverted: false });
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      toast("Moved back to your inbox.", {
        duration: 5000,
        action: { label: "Put it back", onClick: () => void putBack(pieces, taskId) },
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6" aria-label="Arrived">
      <p className="micro-label">ARRIVED</p>
      <ul className="mt-2 space-y-1.5 lg:max-w-[720px]">
        {rows.map((entry) => {
          const head = entryHead(entry);
          const pieces = entryItems(entry);
          const key = entryKey(entry);
          const place = arrivalPlace(head, profile?.org_type);
          return (
            <li
              key={key}
              data-testid="arrival-row"
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground"
            >
              <SourceMark item={head} />
              <span className="min-w-0 max-w-[280px] truncate text-foreground">{head.title}</span>
              {isConversationGroup(entry) ? (
                <span className="font-mono text-[10px] text-soft">
                  {pieces.length} pieces
                </span>
              ) : null}
              <span className="font-mono text-[10px] text-soft">
                {arrivalWhen(head.captured_at)}
              </span>
              <span>{place.text}</span>
              {place.mapped ? (
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => void undo(pieces, key, place.taskId)}
                  className="text-[11.5px] font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
                >
                  Undo
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!showAll && arrivals.length > rows.length ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Show all ({arrivals.length})
        </button>
      ) : null}
    </section>
  );
}
