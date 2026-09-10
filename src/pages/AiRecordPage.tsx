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
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { VendorBrandMark } from "@/components/work/VendorBrandMark";
import { BrandLogo } from "@/components/connectors/BrandLogo";
import { SubjectsPanel } from "@/components/work/SubjectsPanel";
import { WorkRow } from "@/components/work/WorkRow";
import { useChatSearchSignal } from "@/hooks/use-chat-search-signal";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { effectiveWorkDate, type WorkItemRow } from "@/lib/work-types";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { vendorLabel } from "@/lib/conversation-shared";
import { vendorFromSource, type ToolVendor } from "@/lib/work-taxonomy";
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
 * Every conversation you have kept, grouped by the engagement it was
 * mapped into. No charts, no counts as measures of a person: the longitudinal
 * reading here is the What recurs analysis and nothing else.
 */
export function AiRecordPage() {
  const { data: profile } = useProfile();
  const { data: work } = useWorkItems();
  const [peek, setPeek] = useState<{ entry: PeekEntry } | null>(null);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSubjects, setShowSubjects] = useState(false);
  const [tool, setTool] = useState<ToolVendor | "all">("all");

  const threads = (work?.items ?? []).filter((i) => i.type === "ai_thread");
  // The id list is sorted before it becomes part of a key, so a reordered but
  // identical set of threads does not churn the cache and repaint the page.
  const threadIds = threads.map((i) => i.id);
  const threadKey = [...threadIds].sort().join(",");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? threads.filter((i) => (i.title ?? "").toLowerCase().includes(needle))
    : threads;
  // Chips read the tools already present in the loaded rows, so the row never
  // offers a filter that would empty the page.
  const toolsPresent = Array.from(new Set(threads.map((i) => vendorFromSource(i))));
  const visible = tool === "all" ? shown : shown.filter((i) => vendorFromSource(i) === tool);
  const groups = groupItems(visible);
  const mappedCount = threads.filter((i) =>
    i.work_item_tasks.some((m) => Boolean(m.tasks?.engagements)),
  ).length;
  const subtitle = `${threads.length} conversation${threads.length === 1 ? "" : "s"} · ${mappedCount} mapped`;
  const searchSignal = useChatSearchSignal(query, shown.length);


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
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      <div className="min-w-0">
      <PageHeader title="Chat" italicWord="library" subtitle={subtitle} />

      <div className="-mt-2 mb-6 flex items-center gap-2.5">
        <BrandLogo brand="claude" size={16} />
        <BrandLogo brand="chatgpt" size={16} />
        <BrandLogo brand="gemini" size={16} />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          All your tools, one place
        </span>
      </div>

      {threads.length > 0 ? (
        <div className="mb-6">
          <label htmlFor="chat-library-search" className="sr-only">
            Search your chats
          </label>
          <input
            id="chat-library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") searchSignal.onSubmitQuery();
            }}
            placeholder="Search your chats"
            className="w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 sm:max-w-sm"
          />
        </div>
      ) : null}

      {threads.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {(["all", ...toolsPresent] as const).map((option) => {
            const on = tool === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={on}
                onClick={() => setTool(option as ToolVendor | "all")}
                className={
                  on
                    ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground"
                    : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground"
                }
              >
                {option === "all"
                  ? "Everything"
                  : option === "unknown"
                    ? "Other"
                    : vendorLabel(option)}
              </button>
            );
          })}
        </div>
      ) : null}

      {threads.length > 0 ? (
        <div className="mb-6 space-y-3">
          <button
            type="button"
            onClick={() => setShowSubjects((prev) => !prev)}
            className="text-xs font-medium text-accent-deep underline-offset-4 transition-opacity hover:opacity-70"
          >
            {showSubjects ? "Hide subjects" : "Subjects and links"}
          </button>
          {showSubjects ? <SubjectsPanel profileId={profile?.id} items={threads} /> : null}
        </div>
      ) : null}

      {threads.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-8 text-center">
          <p className="text-sm text-foreground">
            Your chat library is empty. Keep your first conversation here and it stays yours to
            find and reuse.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Push one from your assistant, paste one in, or import from a connector on the Work
            page.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No chats match that search.</p>
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
                        searchSignal.onResultOpened();
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
                          <VendorBrandMark item={item} />
                          <span>
                            {turnCounts?.[item.id] ?? 0} message
                            {(turnCounts?.[item.id] ?? 0) === 1 ? "" : "s"}
                          </span>
                          {(fed?.[item.id] ?? []).length > 0 ? (
                            <span>Fed: {(fed?.[item.id] ?? []).join(", ")}</span>
                          ) : null}
                          <span onClick={(event) => event.stopPropagation()}>
                            <ChatUrlLink item={item} />
                          </span>
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
        onAnalyse={(item) => setLensItem(item)}
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
