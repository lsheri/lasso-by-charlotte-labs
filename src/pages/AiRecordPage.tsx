import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { PeekActionBar } from "@/components/peek/PeekActionBar";
import { PeekPanel, type PeekEntry } from "@/components/peek/PeekPanel";
import { RenderedContent } from "@/components/peek/RenderedContent";
import { ThreadBody } from "@/components/peek/ThreadBody";
import {
  AnalysisChips,
  InlineAnalysisBlocks,
  useChatAnalyses,
} from "@/components/reflect/ChatAnalyses";
import { AnalysisLens } from "@/components/reflect/AnalysisLens";
import { ThinkingIndicator } from "@/components/common/Working";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/connectors/BrandLogo";
import { SubjectsPanel } from "@/components/work/SubjectsPanel";
import { ChatRow, chatWhen, fedPhrase } from "@/components/work/ChatRow";
import { WorkNote } from "@/components/work/WorkNote";
import {
  noteChatViewChangedFn,
  noteFilterChangedFn,
  noteReaderClosedFn,
} from "@/lib/chat-library.functions";
import { useChatSearchSignal } from "@/hooks/use-chat-search-signal";
import { useMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { effectiveWorkDate, type WorkItemRow } from "@/lib/work-types";
import { engagementHue } from "@/lib/work-identity";
import { GraphiteSeam } from "@/components/notebook/marks";
import { GraphiteIcon } from "@/components/notebook/icons";
import { ToneCard } from "@/components/notebook/ToneCard";
import { vendorLabel } from "@/lib/conversation-shared";
import { vendorFromSource, type ToolVendor } from "@/lib/work-taxonomy";
import { markOpenStart } from "@/lib/perf-timing";
import { peekFormat } from "@/lib/peek-format";
import { getWorkFileUrl } from "@/lib/work-files.functions";
import { formatDate } from "@/lib/work-types";

type MonthGroup = { key: string; label: string; items: WorkItemRow[] };

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

/** Newest month first, newest item first inside it. Dates identify, they never trend. */
function groupByMonth(items: WorkItemRow[]): MonthGroup[] {
  const buckets = new Map<string, MonthGroup>();
  const undated: WorkItemRow[] = [];
  for (const item of items) {
    const at = new Date(effectiveWorkDate(item));
    if (Number.isNaN(at.getTime())) {
      undated.push(item);
      continue;
    }
    const key = `${at.getFullYear()}-${String(at.getMonth()).padStart(2, "0")}`;
    const label =
      at.getFullYear() === new Date().getFullYear()
        ? MONTHS[at.getMonth()]!
        : `${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
    const bucket = buckets.get(key) ?? { key, label, items: [] };
    bucket.items.push(item);
    buckets.set(key, bucket);
  }
  const ordered = Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  for (const bucket of ordered) {
    bucket.items.sort(
      (a, b) => new Date(effectiveWorkDate(b)).getTime() - new Date(effectiveWorkDate(a)).getTime(),
    );
  }
  if (undated.length > 0)
    ordered.push({ key: "undated", label: "No date recorded", items: undated });
  return ordered;
}

/** The first engagement a conversation is mapped into, if any. */
function firstEngagement(item: WorkItemRow): { id: string; code: string; title: string } | null {
  return item.work_item_tasks?.[0]?.tasks?.engagements ?? null;
}

/** Every engagement a conversation is mapped into. */
function itemEngagements(item: WorkItemRow): { id: string; code: string; title: string }[] {
  return (item.work_item_tasks ?? [])
    .map((m) => m.tasks?.engagements)
    .filter((e): e is { id: string; code: string; title: string } => Boolean(e));
}

/** The model that answered, when the source kept one. */
function itemModel(item: WorkItemRow): string | null {
  const meta = item.source_meta as { model?: unknown } | null;
  return typeof meta?.model === "string" ? meta.model : null;
}

/**
 * Every conversation you have kept, grouped by the engagement it was
 * mapped into. No charts, no counts as measures of a person: the longitudinal
 * reading here is the What recurs analysis and nothing else.
 */
export function AiRecordPage() {
  const { data: profile } = useProfile();
  const { data: work } = useWorkItems();
  const fetchFileUrl = useServerFn(getWorkFileUrl);
  const [peek, setPeek] = useState<{ entry: PeekEntry } | null>(null);
  const [selected, setSelected] = useState<WorkItemRow | null>(null);
  const [desktopReader, setDesktopReader] = useState(false);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);
  const [query, setQuery] = useState("");
  const [showSubjects, setShowSubjects] = useState(false);
  const [tool, setTool] = useState<ToolVendor | "all">("all");
  const [engagement, setEngagement] = useState<string | "all">("all");
  const [recursOpen, setRecursOpen] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");
  const readingMotion = useMotion("record.reading");
  const pileMotion = useMotion("work.piles");
  const noteViewChanged = useServerFn(noteChatViewChangedFn);
  const noteReaderClosed = useServerFn(noteReaderClosedFn);
  const noteFilterChanged = useServerFn(noteFilterChangedFn);

  /** One filter path, so the row and the record cannot drift. */
  function chooseTool(next: ToolVendor | "all") {
    setTool(next);
    void noteFilterChanged({
      data: { filter: "tool", selected: next === "all" ? "all" : "one" },
    }).catch(() => {});
  }

  function chooseEngagement(next: string | "all") {
    setEngagement(next);
    setRecursOpen(false);
    void noteFilterChanged({
      data: { filter: "engagement", selected: next === "all" ? "all" : "one" },
    }).catch(() => {});
  }

  // Read after mount so the server and the first client render agree. Blocked
  // site data throws here, and a saved preference is never worth a broken page.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("lasso.chatlib.view");
      if (saved === "cards" || saved === "list") setView(saved);
    } catch {
      // Stay on cards.
    }
  }, []);

  function chooseView(next: "cards" | "list") {
    setView(next);
    try {
      window.localStorage.setItem("lasso.chatlib.view", next);
    } catch {
      // The choice still holds for this visit.
    }
    void noteViewChanged({ data: { view: next } }).catch(() => {});
  }

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1100px)");
    const update = () => setDesktopReader(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReader("escape");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
  // Engagements are read from the loaded rows for the same reason the tools are.
  const engagementCounts = new Map<string, { id: string; code: string; title: string; count: number }>();
  let unmappedCount = 0;
  for (const item of threads) {
    const mapped = itemEngagements(item);
    if (mapped.length === 0) {
      unmappedCount += 1;
      continue;
    }
    const seen = new Set<string>();
    for (const e of mapped) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const row = engagementCounts.get(e.id) ?? { id: e.id, code: e.code, title: e.title, count: 0 };
      row.count += 1;
      engagementCounts.set(e.id, row);
    }
  }
  const engagementsPresent = Array.from(engagementCounts.values()).sort(
    (a, b) => b.count - a.count || a.code.localeCompare(b.code),
  );
  const byTool = tool === "all" ? shown : shown.filter((i) => vendorFromSource(i) === tool);
  const visible =
    engagement === "all"
      ? byTool
      : engagement === "unmapped"
        ? byTool.filter((i) => itemEngagements(i).length === 0)
        : byTool.filter((i) => itemEngagements(i).some((e) => e.id === engagement));
  const groups = groupByMonth(visible);
  const selectedEngagement =
    engagement === "all" || engagement === "unmapped"
      ? null
      : (engagementsPresent.find((e) => e.id === engagement) ?? null);
  const mappedCount = threads.filter((i) =>
    i.work_item_tasks.some((m) => Boolean(m.tasks?.engagements)),
  ).length;
  // Figma 27:635 subtitle: "142 conversations on the record · 61 checked at
  // source · 17 new since Friday". "Checked at source" is a provenance count
  // this page has no read for, so it is left out rather than approximated; the
  // two clauses that are true are said, plus how many arrived this week.
  const weekAgo = Date.now() - 7 * 24 * 3_600_000;
  const newThisWeek = threads.filter((i) => {
    const at = new Date(i.captured_at ?? "").getTime();
    return Number.isFinite(at) && at >= weekAgo;
  }).length;
  const subtitle = [
    `${threads.length} conversation${threads.length === 1 ? "" : "s"} on the record`,
    `${mappedCount} mapped`,
    newThisWeek > 0 ? `${newThisWeek} new this week` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const searchSignal = useChatSearchSignal(query, shown.length);

  /** One close path: the button, Escape and reselecting all come through here. */
  function closeReader(how: "button" | "escape" | "reselect") {
    setSelected(null);
    void noteReaderClosed({ data: { view, how } }).catch(() => {});
  }

  /** One open path, shared by the list and the cards so they cannot drift. */
  function openItem(item: WorkItemRow) {
    if (desktopReader && selected?.id === item.id) {
      closeReader("reselect");
      return;
    }
    searchSignal.onResultOpened();
    markOpenStart("peek.open");
    if (desktopReader) {
      setSelected(item);
      setPeek(null);
    } else {
      setPeek({ entry: item });
    }
  }

  async function download(item: WorkItemRow) {
    try {
      const { url } = await fetchFileUrl({ data: { work_item_id: item.id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }


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
    <div className="nb-chatview" data-reader={selected ? "open" : "closed"}>
      <div className="nb-chatview-list">
      <PageHeader
        title="All AI"
        italicWord="conversations"
        subtitle={subtitle}
        action={
          /* Figma 27:635 hangs one control off the title: the way a
             conversation gets in here by hand. */
          <PasteThreadDialog
            trigger={
              <Button type="button" variant="outline">
                Add a chat yourself
              </Button>
            }
          />
        }
      />

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
        <div
          role="group"
          aria-label="Filter by tool"
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          {(["all", ...toolsPresent] as const).map((option) => {
            const on = tool === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={on}
                onClick={() => chooseTool(option as ToolVendor | "all")}
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
                {/* Figma 27:635 puts the count inside the chip, so the row of
                    tools is also the shape of the library. */}
                <span className="ml-1.5 font-mono text-[10px] text-soft">
                  {option === "all"
                    ? shown.length
                    : shown.filter((i) => vendorFromSource(i) === option).length}
                </span>
              </button>
            );
          })}
          <span
            role="group"
            aria-label="How conversations are shown"
            className="ml-auto inline-flex items-center rounded-full border border-[var(--nb-rule)] bg-card p-0.5"
          >
            {(["cards", "list"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => chooseView(option)}
                className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                  view === option
                    ? "bg-[var(--nb-ink)] text-[var(--nb-white)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "cards" ? "Cards" : "List"}
              </button>
            ))}
          </span>
        </div>
      ) : null}

      {threads.length > 0 ? (
        <div
          role="group"
          aria-label="Filter by engagement"
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            aria-pressed={engagement === "all"}
            onClick={() => chooseEngagement("all")}
            className={
              engagement === "all"
                ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground"
                : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground"
            }
          >
            Everything
            <span className="ml-1.5 font-mono text-[10px] text-soft">{shown.length}</span>
          </button>
          {engagementsPresent.map((e) => {
            const on = engagement === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={on}
                onClick={() => chooseEngagement(e.id)}
                className={
                  on
                    ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground"
                    : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground"
                }
              >
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: `var(${engagementHue(e.id)})` }}
                />
                {e.code}
                <span className="ml-1.5 font-mono text-[10px] text-soft">{e.count}</span>
              </button>
            );
          })}
          {unmappedCount > 0 ? (
            <button
              type="button"
              aria-pressed={engagement === "unmapped"}
              onClick={() => chooseEngagement("unmapped")}
              className={
                engagement === "unmapped"
                  ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground"
                  : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground"
              }
            >
              Unmapped
              <span className="ml-1.5 font-mono text-[10px] text-soft">{unmappedCount}</span>
            </button>
          ) : null}
          {selectedEngagement ? (
            <button
              type="button"
              onClick={() => setRecursOpen((prev) => !prev)}
              className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
            >
              {recursOpen ? "Hide analysis" : "What recurs"}
            </button>
          ) : null}
        </div>
      ) : null}

      {recursOpen && selectedEngagement ? (
        <div className="mb-6 space-y-3 rounded-[var(--radius)] border border-border bg-card p-4">
          <AnalysisChips
            target={{
              kind: "engagement",
              id: selectedEngagement.id,
              title: selectedEngagement.title,
              itemCount: visible.length,
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
                  id: selectedEngagement.id,
                  title: selectedEngagement.title,
                  itemCount: visible.length,
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
          {analyses.error ? <p className="text-sm text-destructive">{analyses.error}</p> : null}
          <InlineAnalysisBlocks results={analyses.results} profileId={profile?.id} />
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
                <SectionHeader
                  title={group.code ? `${group.code} ${group.title}` : group.title}
                  action={
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                        {group.items.length} conversation{group.items.length === 1 ? "" : "s"}
                        {span(group.items) ? ` · ${span(group.items)}` : ""}
                      </span>
                      {group.engagementId ? (
                        <button
                          type="button"
                          onClick={() => setOpenGroup(expanded ? null : group.key)}
                          className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                        >
                          {expanded ? "Hide analysis" : "What recurs"}
                        </button>
                      ) : null}
                    </span>
                  }
                />

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

                {/* Figma 27:635 draws these as a hairline-ruled list, not a
                    stack of bordered cards. Same handlers, same actions: they
                    move onto hover, focus and touch instead of sitting open. */}
                {view === "cards" ? (
                  <div
                    key={`cards:${view}`}
                    className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
                  >
                    {group.items.map((item, index) => (
                      <span
                        key={`${group.key}:${item.id}`}
                        className={pileMotion.className ? "block nb-sticky-wave" : "block"}
                        style={
                          {
                            "--nb-wave-delay": `${Math.min(index, 23) * 26}ms`,
                          } as React.CSSProperties
                        }
                      >
                        <WorkNote
                          item={item}
                          dense
                          onOpen={() => openItem(item)}
                          chips={
                            <>
                              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
                                {turnCounts?.[item.id] ?? 0}{" "}
                                {(turnCounts?.[item.id] ?? 0) === 1 ? "turn" : "turns"}
                              </span>
                              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
                                {fedPhrase(fed?.[item.id] ?? [])}
                              </span>
                              <ChatUrlLink item={item} />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setLensItem(item);
                                }}
                                className="text-[10px] font-medium text-accent-deep"
                              >
                                Analyse
                              </button>
                            </>
                          }
                        />
                      </span>
                    ))}
                  </div>
                ) : (
                <div className="border-t border-[var(--nb-rule)]">
                  {group.items.map((item) => (
                    <div
                      key={`${group.key}:${item.id}`}
                      aria-current={selected?.id === item.id ? "true" : undefined}
                      className={
                        selected?.id === item.id
                          ? "nb-card-lift rounded-[var(--radius)] bg-secondary"
                          : "nb-card-lift"
                      }
                    >
                      <ChatRow
                        item={item}
                        turns={turnCounts?.[item.id] ?? 0}
                        fed={fed?.[item.id] ?? []}
                        when={chatWhen(item.captured_at)}
                        onOpen={() => openItem(item)}
                        actions={
                          <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setLensItem(item);
                              }}
                              className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                            >
                              Analyse
                            </button>
                            <ChatUrlLink item={item} />
                          </>
                        }
                      />
                    </div>
                  ))}
                </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {threads.length > 0 ? (
        <>
          {/* Figma 27:635 closes the list by saying how much of it you are
              looking at, and that nothing was thrown away to get there. */}
          <p className="mt-4 border-t border-[var(--nb-rule)] pt-3 text-[12px] text-muted-foreground">
            Showing {visible.length} of {threads.length}. Nothing is deleted here.
          </p>
          <CaptureCoverage
            profileId={profile?.id}
            itemCount={threads.length}
            scopeLabel="your chat library"
            dates={threads.map((t) => effectiveWorkDate(t))}
          />
          <p className="font-hand mt-6 text-[16px] text-green">
            nothing here was written by Lasso
          </p>
        </>
      ) : null}

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

      <div className="nb-chatview-pane">
        {selected ? (
          <GraphiteSeam className="w-[6px] shrink-0 self-stretch text-[var(--nb-pencil)]" />
        ) : null}
        <div className="w-[520px] max-w-full">
          {selected ? (
            <article
              key={selected.id}
              aria-label={`Reading ${selected.title}`}
              className={readingMotion.className}
            >
              <header className="border-b border-pencil pb-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="page-title break-words text-[22px] leading-snug">
                    {selected.title}
                  </h2>
                  <button
                    type="button"
                    aria-label="Close the reader"
                    onClick={() => closeReader("button")}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <GraphiteIcon name="close" size={18} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span>{vendorLabel(vendorFromSource(selected))}</span>
                  <span>·</span>
                  <span>
                    {turnCounts?.[selected.id] ?? 0}{" "}
                    {(turnCounts?.[selected.id] ?? 0) === 1 ? "turn" : "turns"}
                  </span>
                  <span>·</span>
                  <span>{formatDate(effectiveWorkDate(selected))}</span>
                </div>
                <p className="mt-2">
                  <ChatUrlLink item={selected} />
                </p>
                <PeekActionBar
                  item={selected}
                  canEdit={false}
                  owned={false}
                  onAnalyse={(item) => setLensItem(item)}
                  onShip={() => {}}
                  onBrief={() => {}}
                  onRemove={() => {}}
                  onDelete={() => {}}
                />
              </header>
              <div className="py-5">
                {peekFormat(selected).kind === "thread" ? (
                  <ThreadBody item={selected} enabled />
                ) : (
                  <RenderedContent
                    item={selected}
                    format={peekFormat(selected)}
                    canEdit={false}
                    onDownload={() => void download(selected)}
                  />
                )}
              </div>
              {/* Figma 27:635's own wording for this panel, with no claim beyond what
                  the product already does. The unavailable turn-level provenance
                  panel is deliberately not invented above this card. */}
              <ToneCard tone="paper" label="WHY THIS PANEL EXISTS">
                <p className="text-[13px] leading-[19px] text-foreground">
                  You can always see what the AI actually read before it answered.
                </p>
                <p className="mt-1 text-[12px] leading-[18px] text-muted-foreground">
                  If a line is not in the record, it is dropped, never repaired.
                </p>
              </ToneCard>
            </article>
          ) : null}
        </div>
      </div>
    </div>
  );
}
