import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { useEngagementDecisions, srcsOf } from "@/hooks/use-decisions";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";
import { engagementDisplayCode } from "@/lib/clients";
import type { EngagementRow } from "@/lib/engagement-page-shared";
import { cn } from "@/lib/utils";
import { effectiveWorkDate, formatDate, type WorkItemRow, type WorkType } from "@/lib/work-types";

type StripTask = {
  id: string;
  name: string;
  owner_id: string | null;
  detail: string | null;
  work_item_tasks: {
    work_items: {
      id?: string;
      type: WorkType;
      captured_at: string;
    } | null;
  }[];
};

/** "02 SEP" — the mono date Figma 36:1936 puts on a shipped card. */
function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${d.toLocaleString("en-US", { month: "short" }).toUpperCase()}`;
}

function ownershipLabel(ownerId: string | null, profileId: string | undefined): string {
  if (!ownerId) return "No owner";
  if (ownerId === profileId) return "Yours";
  return "Owned";
}

type KindBucket = { key: string; count: number; label: string };

function kindCounts(items: { type: WorkType }[]): KindBucket[] {
  let chats = 0;
  let transcripts = 0;
  let documents = 0;
  for (const item of items) {
    if (item.type === "ai_thread" || item.type === "message") chats += 1;
    else if (item.type === "call") transcripts += 1;
    else documents += 1;
  }
  const out: KindBucket[] = [];
  if (chats > 0) out.push({ key: "chat", count: chats, label: chats === 1 ? "chat" : "chats" });
  if (transcripts > 0)
    out.push({ key: "transcript", count: transcripts, label: transcripts === 1 ? "transcript" : "transcripts" });
  if (documents > 0)
    out.push({ key: "document", count: documents, label: documents === 1 ? "document" : "documents" });
  return out;
}

function quietLine(items: { captured_at: string }[]): string | null {
  if (items.length === 0) return "nothing yet";
  const latest = Math.max(...items.map((item) => new Date(item.captured_at).getTime()));
  const days = Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24));
  if (days > 10) return `quiet for ${days} days`;
  return null;
}

/**
 * Figma 36:1936, node 36:2086 "engagement strip · expanded".
 *
 * A full-width horizontal band under the page header holding two horizontal
 * rows: the workstreams with their fill bars, then the shipped cards abreast.
 * The frame's own caption is the brief: "the strip opens once, then gets out
 * of the way".
 *
 * Tone carries meaning here, per ToneCard's contract. A deliverable that has
 * been shipped to the firm wears the record green and says how much of it was
 * checked at source. One that has not wears the claim yellow and says what is
 * being asked of you.
 *
 * `expanded` / `onExpandedChange` are OPTIONAL. Passing them makes the strip
 * controlled, so a composer rendered elsewhere on the page can still collapse
 * it. Omitting them keeps the original self-managed behaviour.
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

  // Both reads are already cached for this page: decisions ride the engagement
  // payload, shipped work is the same list the archive renders.
  const { data: decisions } = useEngagementDecisions(engagement.id);
  const { data: shipped } = useShippedWork();
  const { data: profile } = useProfile();

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
   * Figma puts "4 pieces · 2 calls" on each workstream. `decisions` carries no
   * task_id, so the link is derived: a decision belongs to a workstream when it
   * cites a piece of work mapped to that workstream.
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

  // The fill bar under each workstream is relative weight, not progress toward
  // a target: the busiest workstream fills the bar and the rest read against it.
  const counts = tasks.map(
    (task) => task.work_item_tasks.filter((link) => Boolean(link.work_items)).length,
  );
  const maxCount = Math.max(1, ...counts);

  // Shipped-ness decides the card's tone, so it has to come from the record
  // rather than from the deliverable's type.
  const shippedForEngagement = (shipped ?? []).filter(
    (card) => card.engagement_id === engagement.id,
  );
  const tracedByItem = new Map(
    shippedForEngagement.map((card) => [card.work_item_id, card.traced_facts]),
  );

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
          {/* Row one: the workstreams across the page, each over its fill bar. */}
          <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tasks.map((task) => {
              const count = task.work_item_tasks.filter((link) => Boolean(link.work_items)).length;
              const calls = callsByTask.get(task.id) ?? 0;
              const pct = Math.max(6, Math.round((count / maxCount) * 100));
              const items = task.work_item_tasks
                .map((link) => link.work_items)
                .filter((item): item is Exclude<typeof item, null> => Boolean(item));
              const owner = ownershipLabel(task.owner_id, profile?.id);
              const kinds = kindCounts(items);
              const quiet = quietLine(items);
              return (
                <div key={task.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{task.name}</p>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[10px] uppercase tracking-[0.08em]",
                        owner === "No owner" ? "text-[var(--nb-pencil)]" : "text-muted-foreground",
                      )}
                    >
                      {owner}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {count} {count === 1 ? "piece" : "pieces"}
                    {calls > 0 ? ` · ${calls} ${calls === 1 ? "call" : "calls"}` : ""}
                  </p>
                  <div className="mt-2 h-[3px] w-full rounded-full bg-[var(--nb-rule)]">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {kinds.map((kind) => (
                      <span
                        key={kind.key}
                        className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
                      >
                        {kind.count} {kind.label}
                      </span>
                    ))}
                    {quiet && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {quiet}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row two: shipped, three cards abreast, toned by whether they shipped. */}
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
                  const traced = tracedByItem.get(item.id);
                  const isShipped = traced !== undefined;
                  return (
                    <ToneCard
                      key={item.id}
                      tone={isShipped ? "record" : "claim"}
                      label={stamp || formatDate(effectiveWorkDate(item))}
                      title={item.title}
                      meta={
                        isShipped
                          ? traced > 0
                            ? `${traced} ${traced === 1 ? "source" : "sources"} · checked at source`
                            : "shipped to the firm"
                          : "WAITING ON YOU · claim it or say not mine"
                      }
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
