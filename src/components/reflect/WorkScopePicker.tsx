import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MappedWorkChecklist } from "@/components/reflect/MappedWorkChecklist";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EngagementSummary } from "@/hooks/use-engagements";
import type { ContextScope } from "@/lib/reflect-shared";
import { chipShape, itemsInScope, mappedItemsForEngagement } from "@/lib/reflect-scope-shape";
import type { WorkItemRow } from "@/lib/work-types";
import { engagementDisplayCode, engagementLabel } from "@/lib/clients";

/** The scope as a plain sentence, never a count of tokens or a cost. */
export function scopeSentence(
  scope: ContextScope,
  all: WorkItemRow[],
  engagements: EngagementSummary[],
): string {
  if (scope.mode === "whole") return "All of your work";
  const shape = chipShape(scope, all);
  const resolved = itemsInScope(scope, all);
  if (shape.kind === "engagement") {
    const engagement = engagements.find((e) => e.id === shape.engagementId);
    const whole = mappedItemsForEngagement(all, shape.engagementId).length;
    if (engagement && resolved.length === whole) {
      return `All work in ${engagementLabel(engagement)}`;
    }
  }
  if (resolved.length === 1) return `1 piece of work selected`;
  return `${resolved.length} pieces of work selected`;
}

/**
 * Choose which pieces of work feed the conversation. Only mapped work appears:
 * mapping is the consent act, and the selector must not undo it. Nothing here
 * mentions tokens, cost or speed; this is about focus.
 */
export function WorkScopePicker({
  open,
  onOpenChange,
  scope,
  all,
  engagements,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ContextScope;
  all: WorkItemRow[];
  engagements: EngagementSummary[];
  onApply: (next: ContextScope) => void;
}) {
  const shape = chipShape(scope, all);
  const initialEngagement =
    shape.kind === "engagement"
      ? shape.engagementId
      : shape.kind === "item"
        ? (shape.item.work_item_tasks[0]?.tasks?.engagement_id ?? engagements[0]?.id ?? null)
        : (engagements[0]?.id ?? null);

  const [engagementId, setEngagementId] = useState<string | null>(initialEngagement);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const next = initialEngagement;
    setEngagementId(next);
    if (!next) return setChecked(new Set());
    const universe = mappedItemsForEngagement(all, next);
    const current = itemsInScope(scope, all).filter((i) => universe.some((u) => u.id === i.id));
    setChecked(new Set((current.length > 0 ? current : universe).map((i) => i.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const universe = engagementId ? mappedItemsForEngagement(all, engagementId) : [];

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (!engagementId) return onOpenChange(false);
    const ids = universe.filter((i) => checked.has(i.id)).map((i) => i.id);
    const next: ContextScope =
      ids.length === universe.length && ids.length > 0
        ? { mode: "engagements", ids: [engagementId] }
        : { mode: "items", ids };
    onApply(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Which work feeds this conversation?</DialogTitle>
        </DialogHeader>

        {engagements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Map some work to an engagement and it will appear here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {engagements.map((engagement) => (
                <button
                  key={engagement.id}
                  type="button"
                  onClick={() => {
                    setEngagementId(engagement.id);
                    setChecked(
                      new Set(mappedItemsForEngagement(all, engagement.id).map((i) => i.id)),
                    );
                  }}
                  className={
                    engagement.id === engagementId
                      ? "rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
                      : "rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {engagementDisplayCode(engagement) ?? "Folder"}
                </button>
              ))}
            </div>

            <div className="max-h-80 space-y-4 overflow-y-auto rounded-[var(--radius)] border border-border bg-card p-3">
              <MappedWorkChecklist
                items={universe}
                engagementId={engagementId ?? ""}
                checked={checked}
                onToggle={toggle}
              />
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Only work you have mapped appears here. Private and unmapped work stays out.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={engagements.length === 0}>
            Use this selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
