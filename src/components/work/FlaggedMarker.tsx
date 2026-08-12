import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";

export function isFlaggedRestatement(item: WorkItemRow): boolean {
  return item.source_meta?.duplicate_of_transcript === true;
}

/**
 * Quiet, never automatic. Lasso says what it noticed, the owner decides whether
 * the item stays in the record.
 */
export function FlaggedMarker({ item }: { item: WorkItemRow }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function keep() {
    setBusy(true);
    const meta = { ...(item.source_meta ?? {}), duplicate_of_transcript: false };
    await supabase.from("work_items").update({ source_meta: meta }).eq("id", item.id);
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const { removeWorkItems } = await import("@/lib/work-bulk.functions");
    await removeWorkItems({ data: { ids: [item.id] } });
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-secondary/50 px-3 py-2">
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        Looks like part of the conversation, not a separate artifact.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className="text-xs font-medium text-destructive transition-opacity hover:opacity-70 disabled:opacity-40"
      >
        Remove
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void keep()}
        className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        Keep it
      </button>
    </div>
  );
}
