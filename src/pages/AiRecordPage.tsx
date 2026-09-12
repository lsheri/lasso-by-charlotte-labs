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
import { ChatRow, chatWhen } from "@/components/work/ChatRow";
import { useChatSearchSignal } from "@/hooks/use-chat-search-signal";
import { useMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { effectiveWorkDate, type WorkItemRow } from "@/lib/work-types";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { NotebookSpider } from "@/components/notebook/NotebookSpider";
import { ToneCard } from "@/components/notebook/ToneCard";
import { vendorLabel } from "@/lib/conversation-shared";
import { vendorFromSource, type ToolVendor } from "@/lib/work-taxonomy";
import { markOpenStart } from "@/lib/perf-timing";
import { peekFormat } from "@/lib/peek-format";
import { getWorkFileUrl } from "@/lib/work-files.functions";
import { formatDate } from "@/lib/work-types";

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
  const fetchFileUrl = useServerFn(getWorkFileUrl);
  const [peek, setPeek] = useState<{ entry: PeekEntry } | null>(null);
  const [selected, setSelected] = useState<WorkItemRow | null>(null);
  const [desktopReader, setDesktopReader] = useState(false);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSubjects, setShowSubjects] = useState(false);
  const [tool, setTool] = useState<ToolVendor | "all">("all");
  const readingMotion = useMotion("record.reading");

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1100px)");
    const update = () => setDesktopReader(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
    <div className="nb-chatview">
      <div className="nb-chatview-list">
      <PageHeader
        title="Chat"
        italicWord="library"
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
                        onOpen={() => {
                          searchSignal.onResultOpened();
                          markOpenStart("peek.open");
                          if (desktopReader) {
                            setSelected(item);
                            setPeek(null);
                          } else {
                            setPeek({ entry: item });
                          }
                        }}
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
          <article
            key={selected.id}
            aria-label={`Reading ${selected.title}`}
            className={readingMotion.className}
          >
            <header className="border-b border-pencil pb-4">
              <h2 className="page-title break-words text-[22px] leading-snug">{selected.title}</h2>
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
          </article>
        ) : (
          <div className="space-y-4">
            <div className="relative mx-auto h-[200px] w-[200px]" aria-hidden="true">
              <svg viewBox="0 0 200 200" className="h-full w-full">
                <g className="nb-chat-ribbon">
                  <path
                    id="chat-provenance-ring"
                    d="M 100,18 A 82,82 0 1,1 99.9,18"
                    fill="none"
                    stroke="var(--nb-rule)"
                    strokeWidth="1.4"
                  />
                  <text
                    fontFamily="var(--font-mono)"
                    fontSize="9"
                    letterSpacing="0.08em"
                    fill="var(--nb-soft)"
                  >
                    <textPath href="#chat-provenance-ring" startOffset="1%">
                      CLAUDE · CHATGPT · GEMINI · ON THE RECORD · CLAUDE · CHATGPT · GEMINI · ON THE RECORD ·
                    </textPath>
                  </text>
                </g>
              </svg>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <NotebookSpider size={40} />
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground">Pick a conversation to read it here.</p>
            <CaptureCoverage
              profileId={profile?.id}
              itemCount={threads.length}
              scopeLabel="your chat library"
              dates={threads.map((t) => effectiveWorkDate(t))}
            />
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
          </div>
        )}
      </div>
    </div>
  );
}
