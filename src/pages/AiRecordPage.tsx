import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { PeekPanel, type PeekEntry } from "@/components/peek/PeekPanel";
import {
  AnalysisChips,
  InlineAnalysisBlocks,
  useChatAnalyses,
} from "@/components/reflect/ChatAnalyses";
import { AnalysisLens } from "@/components/reflect/AnalysisLens";
import { ThinkingIndicator } from "@/components/common/Working";
import { WorkRow } from "@/components/work/WorkRow";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { effectiveWorkDate, type WorkItemRow } from "@/lib/work-types";
import { markOpenStart } from "@/lib/perf-timing";

type Group = {
  key: string;
  code: string | null;
  title: string;
  engagementId: string | null;
  items: WorkItemRow[];
  latest: number;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The span in plain words. Dates are identifiers here, never a trend. */
function span(items: WorkItemRow[]): string {
  const dates = items
    .map((i) => new Date(effectiveWorkDate(i)))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return "";
  const label = (d: Date) =>
    d.getFullYear() === new Date().getFullYear()
      ? MONTHS[d.getMonth()]!
      : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return label(first) === label(last) ? label(first) : `${label(first)} to ${label(last)}`;
}

function groupItems(items: WorkItemRow[]): Group[] {
  const groups = new Map<string, Group>();
  const unmapped: WorkItemRow[] = [];

  for (const item of items) {
    const engagements = item.work_item_tasks
      .map((m) => m.tasks?.engagements)
      .filter((e): e is { id: string; code: string; title: string } => Boolean(e));
    if (engagements.length === 0) {
      unmapped.push(item);
      continue;
    }
    for (const engagement of engagements) {
      const group = groups.get(engagement.id) ?? {
        key: engagement.id,
        code: engagement.code,
        title: engagement.title,
        engagementId: engagement.id,
        items: [],
        latest: 0,
      };
      if (!group.items.some((i) => i.id === item.id)) group.items.push(item);
      group.latest = Math.max(group.latest, new Date(effectiveWorkDate(item)).getTime() || 0);
      groups.set(engagement.id, group);
    }
  }

  const ordered = Array.from(groups.values()).sort((a, b) => b.latest - a.latest);
  if (unmapped.length > 0) {
    ordered.push({
      key: "unmapped",
      code: null,
      title: "Unmapped, private to you",
      engagementId: null,
      items: unmapped,
      latest: 0,
    });
  }
  return ordered;
}

/**
 * Every AI conversation you have captured, grouped by the engagement it was
 * mapped into. No charts, no counts as measures of a person: the longitudinal
 * reading here is the What recurs analysis and nothing else.
 */
export function AiRecordPage() {
  const { data: profile } = useProfile();
  const { data: work } = useWorkItems();
  const [peek, setPeek] = useState<{ entry: PeekEntry } | null>(null);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const threads = (work?.items ?? []).filter((i) => i.type === "ai_thread");
  // The id list is sorted before it becomes part of a key, so a reordered but
  // identical set of threads does not churn the cache and repaint the page.
  const threadIds = threads.map((i) => i.id);
  const threadKey = [...threadIds].sort().join(",");
  const groups = groupItems(threads);
  const analyses = useChatAnalyses(profile?.id, profile?.org_id);

  const { data: turnCounts } = useQuery({
    queryKey: ["ai-record-turns", threadKey],
    enabled: threads.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await supabase
        .from("turns")
        .select("work_item_id")
        .in("work_item_id", threadIds);
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.work_item_id] = (counts[row.work_item_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const { data: fed } = useQuery({
    queryKey: ["ai-record-links", threadKey],
    enabled: threads.length > 0,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data } = await supabase
        .from("work_item_links")
        .select("from_item_id, to_item_id, status")
        .in("from_item_id", threadIds);
      const byThread: Record<string, string[]> = {};
      const targets = new Set<string>();
      for (const row of data ?? []) {
        if (row.status !== "confirmed") continue;
        targets.add(row.to_item_id);
        byThread[row.from_item_id] = [...(byThread[row.from_item_id] ?? []), row.to_item_id];
      }
      if (targets.size === 0) return {};
      const { data: items } = await supabase
        .from("work_items")
        .select("id, title")
        .in("id", Array.from(targets));
      const titles = new Map((items ?? []).map((i) => [i.id, i.title]));
      const named: Record<string, string[]> = {};
      for (const [threadId, ids] of Object.entries(byThread)) {
        named[threadId] = ids.map((id) => titles.get(id)).filter((t): t is string => Boolean(t));
      }
      return named;
    },
  });

  return (
    <div>
      <PageHeader
        title="AI record"
        subtitle="Every conversation you have captured, in the engagements you mapped them into."
      />

      <CaptureCoverage
        profileId={profile?.id}
        itemCount={threads.length}
        scopeLabel="your record"
        dates={threads.map((t) => effectiveWorkDate(t))}
      />

      {threads.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-8 text-center">
          <p className="text-sm text-foreground">
            Your AI conversations will collect here as you capture them.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Push them from your assistant, paste one in, or import from a connector on the Work
            page.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const expanded = openGroup === group.key;
            return (
              <section key={group.key} className="space-y-3">
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
                  <h2 className="page-title text-[17px]">
                    {group.code ? `${group.code} ${group.title}` : group.title}
                  </h2>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {group.items.length} conversation{group.items.length === 1 ? "" : "s"}
                    {span(group.items) ? ` · ${span(group.items)}` : ""}
                  </span>
                  {group.engagementId ? (
                    <button
                      type="button"
                      onClick={() => setOpenGroup(expanded ? null : group.key)}
                      className="ml-auto text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                    >
                      {expanded ? "Hide analysis" : "What recurs"}
                    </button>
                  ) : null}
                </header>

                {expanded && group.engagementId ? (
                  <div className="space-y-3 rounded-[var(--radius)] border border-border bg-card p-4">
                    <AnalysisChips
                      target={{
                        kind: "engagement",
                        id: group.engagementId,
                        title: group.title,
                        itemCount: group.items.length,
                      }}
                      readsDetail="every piece of work mapped into this engagement, oldest first"
                      running={analyses.running}
                      orgId={profile?.org_id}
                      profileId={profile?.id}
                      onRun={(preset, checkId) =>
                        void analyses.runPreset(
                          preset,
                          {
                            kind: "engagement",
                            id: group.engagementId as string,
                            title: group.title,
                            itemCount: group.items.length,
                          },
                          "every piece of work mapped into this engagement, oldest first",
                          checkId,
                        )
                      }
                    />
                    {analyses.running ? (
                      <>
                        <ThinkingIndicator />
                        {analyses.streamed ? <MarkdownMessage content={analyses.streamed} /> : null}
                      </>
                    ) : null}
                    {analyses.error ? (
                      <p className="text-sm text-destructive">{analyses.error}</p>
                    ) : null}
                    <InlineAnalysisBlocks results={analyses.results} profileId={profile?.id} />
                  </div>
                ) : null}

                <div className="space-y-2">
                  {group.items.map((item) => (
                    <WorkRow
                      key={`${group.key}:${item.id}`}
                      item={item}
                      onOpen={() => {
                        markOpenStart("peek.open");
                        setPeek({ entry: item });
                      }}
                      actions={
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLensItem(item);
                          }}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-opacity hover:opacity-80"
                        >
                          Analyse
                        </button>
                      }
                      footer={
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {turnCounts?.[item.id] ?? 0} message
                            {(turnCounts?.[item.id] ?? 0) === 1 ? "" : "s"}
                          </span>
                          {(fed?.[item.id] ?? []).length > 0 ? (
                            <span>Fed: {(fed?.[item.id] ?? []).join(", ")}</span>
                          ) : null}
                        </div>
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <PeekPanel
        entry={peek?.entry ?? null}
        open={peek !== null}
        onOpenChange={(next) => {
          if (!next) setPeek(null);
        }}
        canEdit={false}
        onFluency={(item) => setLensItem(item)}
      />

      {profile && lensItem ? (
        <AnalysisLens
          key={lensItem.id}
          open
          onOpenChange={(next) => {
            if (!next) setLensItem(null);
          }}
          target={{ kind: "item", id: lensItem.id, title: lensItem.title, scope: "thread" }}
          profileId={profile.id}
          orgId={profile.org_id}
        />
      ) : null}
    </div>
  );
}
