import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { useEngagementDecisions, srcsOf } from "@/hooks/use-decisions";
import { engagementDisplayCode } from "@/lib/clients";
import type { EngagementRow } from "@/lib/engagement-page-shared";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

type StripTask = {
  id: string;
  name: string;
  work_item_tasks: { work_items: unknown | null }[];
};

/** "02 SEP" — the mono date Figma 36:1936 puts on a shipped card. */
function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${d.toLocaleString("en-US", { month: "short" }).toUpperCase()}`;
}

/**
 * Figma 36:1936, node 36:2086 "engagement strip · expanded".
 *
 * It is a STRIP: a full-width horizontal band under the page header, 1080 wide
 * in the frame, holding two horizontal rows — the workstreams, then the shipped
 * cards side by side. It is not a sidebar panel. That is what the frame's own
 * caption means by "the strip opens once, then gets out of the way": it spans
 * the page, then collapses to a thin bar and hands the page back.
 *
 * `expanded` / `onExpandedChange` are OPTIONAL. Passing them makes the strip
 * controlled, so a composer rendered elsewhere on the page can still collapse
 * it. Omitting them keeps the original self-managed behaviour, so existing
 * callers are unaffected.
 */
export function EngagementStrip({
  engagement,
  tasks,
  deliverables,
  collapsed,
  expanded: expandedProp,
  onExpandedChange,
  children,
}: {
  engagement: EngagementRow;
  tasks: StripTask[];
  deliverables: WorkItemRow[];
  collapsed?: boolean;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  children?: (expanded: boolean, setExpanded: Dispatch<SetStateAction<boolean>>) => ReactNode;
}) {
  const [ownExpanded, setOwnExpanded] = useState(true);

  // Passthrough onto the engagement payload the page already loaded, so the
  // call counts below cost no extra request.
  const { data: decisions } = useEngagementDecisions(engagement.id);

  useEffect(() => {
    if (collapsed) setOwnExpanded(false);
  }, [collapsed]);

  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : ownExpanded;

  const setExpanded: Dispatch<SetStateAction<boolean>> = (value) => {
    const next = typeof value === "function" ? (value as (p: boolean) => boolean)(expanded) : value;
    if (isControlled) onExpandedChange?.(next);
    else setOwnExpanded(next);
  };

  const pieceCount = tasks.reduce(
    (total, task) =>
      total + task.work_item_tasks.filter((link) => Boolean(link.work_items)).length,
    0,
  );

  /**
   * Figma 36:1936 puts "4 pieces · 2 calls" on each workstream. `decisions`
   * carries no task_id, so the link is derived: a decision belongs to a
   * workstream when it cites a piece of work mapped to that workstream.
   */
  const callsByTask = new Map<string, number>();
  for (const task of tasks) {
    const itemIds = new Set(
      task.work_item_tasks
        .map((link) => (link.work_items as { id?: string } | null)?.id)
        .filter((id): id is string => Boolean(id)),
    );
    if (itemIds.size === 0) continue;
    const count = (decisions ?? []).filter((row) =>
      srcsOf(row).some((src) => itemIds.has(src.work_item_id)),
    ).length;
    if (count > 0) callsByTask.set(task.id, count);
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-graphite bg-card">
        <div
          className={
            expanded
              ? "flex items-center justify-between gap-3 border-b border-border px-4 py-3"
              : "flex min-h-12 items-center gap-3 px-4 py-2"
          }
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
          {/* Row one: the workstreams, across the page. Figma spaces four at 258px. */}
          <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tasks.map((task) => {
              const count = task.work_item_tasks.filter((link) => Boolean(link.work_items)).length;
              const calls = callsByTask.get(task.id) ?? 0;
              return (
                <div key={task.id} className="border-t border-graphite pt-2">
                  <p className="truncate text-sm font-medium text-foreground">{task.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {count} {count === 1 ? "piece" : "pieces"}
                    {calls > 0 ? ` · ${calls} ${calls === 1 ? "call" : "calls"}` : ""}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Row two: shipped, three cards abreast in the frame. */}
          <div className="border-t border-border px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Shipped, and what is waiting
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deliverables.length > 0 ? (
                deliverables.map((item) => {
                  const stamp = [item.type?.toUpperCase(), shortDate(effectiveWorkDate(item))]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <ToneCard
                      key={item.id}
                      tone="paper"
                      label={stamp || formatDate(effectiveWorkDate(item))}
                      title={item.title}
                    />
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No finished deliverables here yet.</p>
              )}
            </div>
            <p className="font-hand mt-4 text-[16px] text-green">
              the strip opens once, then gets out of the way
            </p>
          </div>
        </div>
      </section>

      {children?.(expanded, setExpanded)}
    </div>
  );
}
