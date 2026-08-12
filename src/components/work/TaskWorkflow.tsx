import { useState } from "react";

import { TypeIcon } from "@/components/work/TypeIcon";
import { workIdentityLabel } from "@/lib/work-identity";
import { WorkDateDialog } from "@/components/work/WorkDateDialog";
import { OpenFileAction } from "@/components/work/OpenFileAction";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { effectiveWorkDate, formatDate, sourceLabel, type WorkItemRow } from "@/lib/work-types";

export type WorkflowElement = {
  step_no: number | null;
  step_confirmed: boolean;
  work_items: WorkItemRow & { owner_id?: string | null };
};

function byDate(a: WorkflowElement, b: WorkflowElement) {
  return (
    new Date(effectiveWorkDate(a.work_items)).getTime() -
    new Date(effectiveWorkDate(b.work_items)).getTime()
  );
}

/** Placed elements first (confirmed order), then anything that arrived after the sequence. */
export function orderElements(elements: WorkflowElement[]): {
  placed: WorkflowElement[];
  unplaced: WorkflowElement[];
  confirmed: boolean;
} {
  const confirmed = elements.some((e) => e.step_confirmed && e.step_no !== null);
  if (!confirmed) return { placed: [...elements].sort(byDate), unplaced: [], confirmed };
  const placed = elements
    .filter((e) => e.step_confirmed && e.step_no !== null)
    .sort((a, b) => (a.step_no ?? 0) - (b.step_no ?? 0));
  const unplaced = elements.filter((e) => !(e.step_confirmed && e.step_no !== null)).sort(byDate);
  return { placed, unplaced, confirmed };
}

export function TaskWorkflow({
  taskId,
  elements,
  canEdit,
  orgId,
  onChanged,
}: {
  taskId: string;
  elements: WorkflowElement[];
  canEdit: boolean;
  orgId: string | undefined;
  onChanged: () => Promise<void> | void;
}) {
  const { placed, unplaced, confirmed } = orderElements(elements);
  const combined = [...placed, ...unplaced];
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateItem, setDateItem] = useState<WorkItemRow | null>(null);

  if (elements.length === 0) {
    return <p className="text-xs text-muted-foreground">No work mapped yet</p>;
  }

  async function persist(order: WorkflowElement[]) {
    setBusy(true);
    setError(null);
    for (const [index, element] of order.entries()) {
      const { error: e } = await supabase
        .from("work_item_tasks")
        .update({ step_no: index + 1, step_confirmed: true })
        .eq("task_id", taskId)
        .eq("work_item_id", element.work_items.id);
      if (e) {
        setError(e.message);
        setBusy(false);
        return;
      }
    }
    if (orgId) logEvent("workflow.reordered", orgId, { item_count: order.length });
    await onChanged();
    setBusy(false);
  }

  async function reset() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase
      .from("work_item_tasks")
      .update({ step_no: null, step_confirmed: false })
      .eq("task_id", taskId);
    if (e) setError(e.message);
    else {
      if (orgId) logEvent("workflow.reset", orgId, {});
      await onChanged();
    }
    setBusy(false);
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= combined.length) return;
    const next = [...combined];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    void persist(next);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {confirmed
            ? "Ordered by your sequence."
            : "Ordered by work date, drag to set the real sequence."}
        </p>
        <div className="flex items-center gap-3">
          {confirmed ? (
            <span className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Confirmed sequence
            </span>
          ) : null}
          {confirmed && canEdit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void reset()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Reset to date order
            </button>
          ) : null}
        </div>
      </div>

      <ul className={busy ? "mt-2 space-y-1 opacity-60" : "mt-2 space-y-1"}>
        {combined.map((element, index) => {
          const item = element.work_items;
          const isNew = index >= placed.length && confirmed;
          return (
            <li key={item.id}>
              {isNew && index === placed.length ? (
                <p className="mb-1 mt-3 border-t border-dashed border-border pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  New, not yet placed
                </p>
              ) : null}
              <div
                draggable={canEdit && !busy}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  if (canEdit) e.preventDefault();
                }}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-3 py-2 ${
                  canEdit ? "cursor-grab" : ""
                }`}
              >
                {confirmed && !isNew ? (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent-deep">
                    {index + 1}
                  </span>
                ) : null}
                <TypeIcon item={item} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.title}</p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {workIdentityLabel(item)} · {sourceLabel(item.source)} ·{" "}
                    {formatDate(effectiveWorkDate(item))}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {item.content_ref ? <OpenFileAction workItemId={item.id} /> : null}
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={busy || index === 0}
                      onClick={() => move(index, index - 1)}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={busy || index === combined.length - 1}
                      onClick={() => move(index, index + 1)}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateItem(item)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Work date
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <WorkDateDialog
        item={dateItem}
        open={dateItem !== null}
        onOpenChange={(next) => {
          if (!next) setDateItem(null);
        }}
      />
    </div>
  );
}
