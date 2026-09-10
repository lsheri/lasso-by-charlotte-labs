import { useEffect, useState, type ReactNode } from "react";

import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { engagementDisplayCode } from "@/lib/clients";
import type { EngagementRow } from "@/lib/engagement-page-shared";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

type StripTask = {
  id: string;
  name: string;
  work_item_tasks: { work_items: unknown | null }[];
};

export function EngagementStrip({
  engagement,
  tasks,
  deliverables,
  collapsed,
  children,
}: {
  engagement: EngagementRow;
  tasks: StripTask[];
  deliverables: WorkItemRow[];
  collapsed?: boolean;
  children?: (expanded: boolean) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (collapsed) setExpanded(false);
  }, [collapsed]);

  const pieceCount = tasks.reduce(
    (total, task) =>
      total + task.work_item_tasks.filter((link) => Boolean(link.work_items)).length,
    0,
  );

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-graphite bg-card">
        <div
          className={expanded ? "flex items-center justify-between gap-3 border-b border-border px-4 py-3" : "flex min-h-12 items-center gap-3 px-4 py-2"}
        >
          {expanded ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              The engagement
            </p>
          ) : (
            <>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground">
                {engagementDisplayCode(engagement) ?? "Quick folder"}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {tasks.length} {tasks.length === 1 ? "workstream" : "workstreams"} · {pieceCount}{" "}
                {pieceCount === 1 ? "piece" : "pieces"} of work
              </span>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em]"
          >
            {expanded ? "Collapse ↑" : "Expand ↓"}
          </Button>
        </div>

        <div className={expanded ? "block" : "hidden"} aria-hidden={!expanded}>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {tasks.map((task) => {
              const count = task.work_item_tasks.filter((link) => Boolean(link.work_items)).length;
              return (
                <div key={task.id} className="border-l border-border pl-3">
                  <p className="text-sm font-medium text-foreground">{task.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {count} {count === 1 ? "piece" : "pieces"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Shipped, and what is waiting
            </p>
            <div className="mt-2 space-y-2">
              {deliverables.length > 0 ? (
                deliverables.map((item) => (
                  <ToneCard
                    key={item.id}
                    tone="paper"
                    title={item.title}
                    meta={formatDate(effectiveWorkDate(item))}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No finished deliverables here yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {children?.(expanded)}
    </div>
  );
}