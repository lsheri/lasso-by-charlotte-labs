import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { AskedSessions, useAskedSessions } from "@/components/reflect/AskedSessions";
import { SlideOver } from "@/components/peek/SlideOver";
import { ReflectPage } from "@/pages/ReflectPage";
import { toast } from "sonner";

import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { DimmedDisabled } from "@/components/common/DimmedDisabled";
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
import { fedPhrase } from "@/components/work/ChatRow";
import { WorkNote } from "@/components/work/WorkNote";
import { CardMenu } from "@/components/work/CardMenu";
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
import { useWorkboardCardPreviews } from "@/hooks/use-workboard-card-previews";
import type { WorkboardCardPreview } from "@/lib/workboard-card-preview.shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { logEvent } from "@/lib/telemetry";

type MonthGroup = { key: string; label: string; items: WorkItemRow[] };
export const CONVERSATION_CARD_HEIGHT = 118;

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
  const dated = Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  const ordered: MonthGroup[] = [];
  if (dated.length > 0) {
    const newest = dated[0];
    const oldest = dated[dated.length - 1];
    if (newest && oldest) {
      const [newestYear, newestMonth] = newest.key.split("-").map(Number);
      const [oldestYear, oldestMonth] = oldest.key.split("-").map(Number);
      const cursor = new Date(newestYear ?? 0, newestMonth ?? 0, 1);
      const end = new Date(oldestYear ?? 0, oldestMonth ?? 0, 1);
      while (cursor >= end) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const key = `${year}-${String(month).padStart(2, "0")}`;
        ordered.push(
          buckets.get(key) ?? {
            key,
            label: year === new Date().getFullYear() ? (MONTHS[month] ?? "") : `${MONTHS[month] ?? ""} ${year}`,
            items: [],
          },
        );
        cursor.setMonth(cursor.getMonth() - 1);
      }
    }
  }
  for (const bucket of ordered) {
    bucket.items.sort(
      (a, b) => new Date(effectiveWorkDate(b)).getTime() - new Date(effectiveWorkDate(a)).getTime(),
    );
  }
  if (undated.length > 0)
    ordered.push({ key: "undated", label: "No date recorded", items: undated });
  return ordered;
}

/** A board glance starts with what the person asked; the reader keeps every turn. */
export function conversationCardPreview(
  preview: WorkboardCardPreview | undefined,
): WorkboardCardPreview | undefined {
  if (!preview) return undefined;
  const firstUserTurn = preview.firstUserTurn
    ?? preview.turns.find((turn) => turn.role.trim().toLowerCase() === "user");
  return { ...preview, turns: firstUserTurn ? [firstUserTurn] : [] };
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
 * Every conversation you have kept, one archive by month. Engagement is a
 * filter and a colour, not the grouping. No charts, no counts as measures of a
 * person: the longitudinal reading here is the What recurs analysis and
 * nothing else.
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
  const [tool, setTool] = useState<ToolVendor | "all">("all");
  const [engagement, setEngagement] = useState<string | "all">("all");
  const [recursOpen, setRecursOpen] = useState(false);
  const [askSession, setAskSession] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const search = useSearch({ strict: false }) as { ask?: boolean; view?: "asked" };
  const askedSessions = useAskedSessions();
  const isCoach = profile?.role === "coach";
  const readingMotion = useMotion("record.reading");
  const pileMotion = useMotion("work.piles");
  const noteViewChanged = useServerFn(noteChatViewChangedFn);
  const noteReaderClosed = useServerFn(noteReaderClosedFn);
  const noteFilterChanged = useServerFn(noteFilterChangedFn);

  /** One filter path, so the row and the record cannot drift. */
  function chooseTool(next: ToolVendor | "all") {
    setTool(next);
    void noteFilterChanged({
      data: { filter: "tool", selected: next === "all" ? "all" : "one", profile_id: profile?.id },
    }).catch(() => {});
  }

  function chooseEngagement(next: string | "all") {
    setEngagement(next);
    setRecursOpen(false);
    void noteFilterChanged({
      data: {
        filter: "engagement",
        selected: next === "all" ? "all" : "one",
        profile_id: profile?.id,
      },
    }).catch(() => {});
  }

  // Arrived here asking a question: open the composer, once.
  useEffect(() => {
    if (search.ask && !isCoach) {
      setAskSession(null);
      setAskOpen(true);
    }
  }, [search.ask, isCoach]);

  useEffect(() => {
    if (search.view === "asked") {
      void noteViewChanged({ data: { view: "asked", profile_id: profile?.id } }).catch(() => {});
    }
  }, [noteViewChanged, profile?.id, search.view]);

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
  const cardPreviews = useWorkboardCardPreviews("chat-library", profile?.id, true, threadIds);
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
  const matchesChipFilters = (item: WorkItemRow) => {
    const matchesTool = tool === "all" || vendorFromSource(item) === tool;
    const matchesEngagement =
      engagement === "all" ||
      (engagement === "unmapped"
        ? itemEngagements(item).length === 0
        : itemEngagements(item).some((e) => e.id === engagement));
    return matchesTool && matchesEngagement;
  };
  const matchingCount = shown.filter(matchesChipFilters).length;
  const countLine = needle
    ? `Showing ${shown.length} of ${threads.length}. Nothing is deleted here.`
    : tool !== "all" || engagement !== "all"
      ? `${matchingCount} of ${threads.length} ${matchingCount === 1 ? "matches" : "match"} what you picked. The rest are still here.`
      : `${threads.length} ${threads.length === 1 ? "conversation" : "conversations"}.`;
  // Search narrows deliberately. Tool and engagement chips leave those search
  // results in place, dimming the conversations outside the chosen categories.
  const groups = groupByMonth(shown);
  const showingAskedHistory = search.view === "asked" && !isCoach;
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
    void noteReaderClosed({ data: { view: "preview", how, profile_id: profile?.id } }).catch(() => {});
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

  function recordPanelOpen(panel: "engagements" | "subjects" | "coverage" | "recurs") {
    if (profile?.org_id) logEvent("chatlib.panel_opened", profile.org_id, { panel });
  }

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
      <div className="nb-chatview-list flex h-[calc(100vh-6.5rem)] min-h-0 flex-col overflow-hidden">
        <header className="box-border flex h-16 shrink-0 items-center gap-2 border-b border-[var(--nb-rule)] px-5">
           <div className="mr-auto min-w-0">
             <h1 className="truncate font-serif text-[19px] leading-none">All AI Conversations</h1>
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{subtitle}</p>
          </div>
          <PasteThreadDialog trigger={<Button type="button" variant="outline" className="h-9">Add a chat</Button>} />
          {isCoach ? null : (
            <Button type="button" variant="outline" className="h-9" onClick={() => { setAskSession(null); setAskOpen(true); }}>
              <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border-2 border-[var(--nb-lasso-green)]" />
              Ask Lasso
            </Button>
          )}
        </header>

        <div className="flex h-[46px] shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--nb-rule)] px-5 whitespace-nowrap">
          <label htmlFor="chat-library-search" className="sr-only">Search your chats</label>
          <input
            id="chat-library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") searchSignal.onSubmitQuery(); }}
            placeholder="Search your chats"
            className="h-7 w-[200px] shrink-0 rounded-[var(--radius)] border border-border bg-card px-3 text-[11.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--nb-rule)]" />
          <div role="group" aria-label="Filter by tool" className="flex shrink-0 items-center gap-2">
            {(["all", ...toolsPresent] as const).map((option) => {
              const on = tool === option;
              return (
                <button key={option} type="button" aria-pressed={on} onClick={() => chooseTool(option as ToolVendor | "all")} className={on ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground" : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground"}>
                  {option === "all" ? "Everything" : option === "unknown" ? "Other" : vendorLabel(option)}
                  <span className="ml-1.5 font-mono text-[10px] text-soft">{option === "all" ? shown.length : shown.filter((item) => vendorFromSource(item) === option).length}</span>
                </button>
              );
            })}
          </div>
          <Popover onOpenChange={(open) => { if (open) recordPanelOpen("engagements"); }}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-7 rounded-full">
                {selectedEngagement?.code ?? (engagement === "unmapped" ? "Unmapped" : "Engagements")}
                {engagement === "all" ? null : <span className="font-mono text-[9px] text-soft">{matchingCount}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <div role="group" aria-label="Filter by engagement" className="flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={engagement === "all"} onClick={() => chooseEngagement("all")} className={engagement === "all" ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground" : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground"}>Everything <span className="ml-1.5 font-mono text-[10px] text-soft">{shown.length}</span></button>
                {engagementsPresent.map((entry) => (
                  <button key={entry.id} type="button" aria-pressed={engagement === entry.id} onClick={() => chooseEngagement(entry.id)} className={engagement === entry.id ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground" : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground"}>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: `var(${engagementHue(entry.id)})` }} />{entry.code}<span className="ml-1.5 font-mono text-[10px] text-soft">{entry.count}</span>
                  </button>
                ))}
                {unmappedCount > 0 ? <button type="button" aria-pressed={engagement === "unmapped"} onClick={() => chooseEngagement("unmapped")} className={engagement === "unmapped" ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground" : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground"}>Unmapped <span className="ml-1.5 font-mono text-[10px] text-soft">{unmappedCount}</span></button> : null}
                {selectedEngagement ? <Button type="button" variant="ghost" size="sm" onClick={() => { if (!recursOpen) recordPanelOpen("recurs"); setRecursOpen((open) => !open); }}>{recursOpen ? "Hide analysis" : "What recurs"}</Button> : null}
              </div>
            </PopoverContent>
          </Popover>
          <div className="ml-auto flex shrink-0 items-center gap-2">
             {!showingAskedHistory ? (
              <Popover onOpenChange={(open) => { if (open) recordPanelOpen("coverage"); }}>
                <PopoverTrigger asChild><Button type="button" variant="ghost" className="h-7 text-[13px] text-muted-foreground">{countLine}</Button></PopoverTrigger>
                <PopoverContent align="end" className="max-h-[70vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto">
                  <CaptureCoverage profileId={profile?.id} itemCount={threads.length} scopeLabel="your chat library" dates={threads.map((thread) => effectiveWorkDate(thread))} />
                  <p className="mt-6 font-hand text-[16px] text-green">nothing here was written by Lasso</p>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
           {showingAskedHistory ? (
            <div className="h-full overflow-y-auto p-5"><AskedSessions sessions={askedSessions} onOpen={(id) => { setAskSession(id); setAskOpen(true); }} /></div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
               <div className="relative min-h-0 flex-1 overflow-y-auto">
                {threads.length === 0 ? (
                  <div className="m-5 rounded-[var(--radius)] border border-dashed border-border p-8 text-center"><p className="text-sm text-foreground">Your chat library is empty. Keep your first conversation here and it stays yours to find and reuse.</p><p className="mt-2 text-sm text-muted-foreground">Push one from your assistant, paste one in, or import from a connector on the Work page.</p></div>
                ) : groups.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No chats match that search.</p> : (
                   <div className="conversation-month-stack p-5" aria-label="AI conversations by month">
                     {groups.map((group) => (
                       <section key={group.key} data-conversation-month={group.key} className={group.items.length === 0 ? "conversation-month-empty" : undefined}>
                         <div className="flex min-h-10 items-center gap-3">
                           <h2 className="font-hand text-[19px] leading-none text-graphite">{group.label}</h2>
                           <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{group.items.length}</span>
                           <span className="h-px flex-1 bg-[var(--nb-rule)]" />
                         </div>
                         {group.items.length > 0 ? (
                           <div className="conversation-month-grid">
                             {group.items.map((item, index) => {
                               const matches = matchesChipFilters(item);
                               return (
                                 <DimmedDisabled key={item.id} dimmed={!matches} disabled={!matches} className="h-[118px] min-w-0">
                                   <div data-lane-content style={{ height: `${CONVERSATION_CARD_HEIGHT}px` }} className="h-full min-w-0">
                                   <span className={`${pileMotion.className ? "nb-sticky-wave " : ""}conversation-card-compact canvas-lab-card-paper block h-full min-w-0`} style={{ "--nb-wave-delay": `${Math.min(index, 23) * 26}ms` } as React.CSSProperties}>
                                     <WorkNote item={item} dense displayMode="preview" chatPreview={conversationCardPreview(cardPreviews[item.id])} onOpen={() => openItem(item)} actions={(
                                       <CardMenu item={item} onFluency={(nextItem) => setLensItem(nextItem)}>
                                         {firstEngagement(item) ? <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: `var(${engagementHue(firstEngagement(item)?.id ?? "")})` }}>{firstEngagement(item)?.code}</span> : <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">UNMAPPED</span>}
                                         {itemModel(item) ? <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{itemModel(item)}</span> : null}
                                         <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{turnCounts?.[item.id] ?? 0} {(turnCounts?.[item.id] ?? 0) === 1 ? "turn" : "turns"}</span>
                                         {(fed?.[item.id] ?? []).length > 0 ? <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-green">{fedPhrase(fed?.[item.id] ?? [])}</span> : null}
                                         <ChatUrlLink item={item} showAbsence />
                                       </CardMenu>
                                     )} />
                                   </span>
                                   </div>
                                 </DimmedDisabled>
                               );
                             })}
                           </div>
                         ) : null}
                       </section>
                     ))}
                   </div>
                )}
              </div>
            </div>
          )}
        </div>

        <SlideOver open={askOpen} onOpenChange={(next) => { setAskOpen(next); if (!next) setAskSession(null); }} title="Ask Lasso" description="Private to you. Your coach never sees this." className="sm:w-[720px] sm:max-w-[760px]">
          <div className="overflow-y-auto p-4">{askOpen ? <ReflectPage embedded initialSessionId={askSession} autoStart={askSession === null} /> : null}</div>
        </SlideOver>
        <SlideOver open={recursOpen && Boolean(selectedEngagement)} onOpenChange={(open) => setRecursOpen(open)} title="What recurs">
          <div className="space-y-3 overflow-y-auto p-5">
            <h2 className="font-serif text-[19px]">What recurs</h2>
            {selectedEngagement ? <AnalysisChips target={{ kind: "engagement", id: selectedEngagement.id, title: selectedEngagement.title, itemCount: matchingCount }} readsDetail="every piece of work mapped into this engagement, oldest first" running={analyses.running} orgId={profile?.org_id} profileId={profile?.id} onRun={(preset, checkId) => void analyses.runPreset(preset, { kind: "engagement", id: selectedEngagement.id, title: selectedEngagement.title, itemCount: matchingCount }, "every piece of work mapped into this engagement, oldest first", checkId)} /> : null}
            {analyses.running ? <><ThinkingIndicator />{analyses.streamed ? <MarkdownMessage content={analyses.streamed} /> : null}</> : null}
            {analyses.error ? <p className="text-sm text-destructive">{analyses.error}</p> : null}
            <InlineAnalysisBlocks results={analyses.results} profileId={profile?.id} />
          </div>
        </SlideOver>
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

      <div className={`nb-chatview-pane ${selected && desktopReader ? "h-[calc(100vh-6.5rem)] overflow-y-auto" : "hidden"}`}>
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
