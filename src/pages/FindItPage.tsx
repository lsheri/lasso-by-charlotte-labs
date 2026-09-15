import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { GraphiteCheck } from "@/components/notebook/marks";
import { NotebookSpider } from "@/components/notebook/NotebookSpider";
import { ToneCard } from "@/components/notebook/ToneCard";
import { FindItSheet } from "@/components/find-it/FindItSheet";
import { WorkNote } from "@/components/work/WorkNote";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePerfTimerFactory } from "@/hooks/use-perf-timer";
import { useProfile } from "@/hooks/use-profile";
import { useMotion, useReducedMotion } from "@/hooks/use-motion";
import { useWorkItems } from "@/hooks/use-work-items";
import {
  findSources as findSourcesFn,
  searchRecord as searchRecordFn,
  type FindScope,
  type FindSourcesResult,
  type RecordSearchResult,
} from "@/lib/find-it.functions";
import { reviewLink as reviewLinkFn } from "@/lib/lineage.functions";
import { isDeliverableType, linkBucket } from "@/lib/lineage-shared";
import { logEvent } from "@/lib/telemetry";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

/** Files Find it can read. Anything else is left alone, and said so. */
const READABLE_EXTENSIONS = ["pdf", "doc", "docx", "txt", "md", "ppt", "pptx", "key", "xls", "xlsx", "csv"];

const UNREADABLE_FILE_MESSAGE =
  "Lasso reads documents, decks, sheets and transcripts. That one it cannot read.";

function isReadableFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return READABLE_EXTENSIONS.includes(ext);
}

type Mode = "sources" | "number" | "thread";

const MODE_CHIPS: { mode: Mode; label: string }[] = [
  { mode: "sources", label: "Where did this come from?" },
  { mode: "number", label: "Find a number" },
  { mode: "thread", label: "A thread I lost" },
];

function isConversation(item: WorkItemRow): boolean {
  return item.type === "ai_thread";
}

/** What can be traced: the finished things, plus call transcripts. */
function isTraceable(item: WorkItemRow): boolean {
  return isDeliverableType(item.type) || item.type === "call";
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-[6px] border border-[var(--nb-yellow-edge)] bg-[var(--nb-yellow-wash)] px-3 py-1.5 text-[13px] text-foreground"
    : "rounded-[6px] border border-hairline bg-card px-3 py-1.5 text-[13px] text-muted-foreground";
}

/** The words are shown back exactly as they were found, never reworded. */
function Highlighted({ text, needle }: { text: string; needle: string }) {
  const at = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[4px] bg-[var(--nb-yellow-wash)] px-0.5 text-[var(--nb-yellow-ink)]">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}

export function FindItPage() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/find-it" });
  const { data, isLoading } = useWorkItems();
  const reduceMotion = useReducedMotion();
  const perfTimer = usePerfTimerFactory();
  const keptMotion = useMotion("findit.kept");
  const rowMotion = useMotion("findit.search_landed");
  const spiderMotion = useMotion("ai.working");
  const { capture, pending: capturing } = useCaptureFiles();

  const items = useMemo(() => data?.items ?? [], [data]);
  const chats = useMemo(() => items.filter(isConversation), [items]);
  const traceable = useMemo(() => items.filter(isTraceable), [items]);

  // Looking back through your own conversations is the person's own business.
  // A coach never reads someone else's record this way.
  const isCoach = profile?.role === "coach";
  useEffect(() => {
    if (isCoach) navigate({ to: "/coaching", replace: true });
  }, [isCoach, navigate]);

  const [mode, setMode] = useState<Mode>("sources");
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState<string | null>(search.target ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scope, setScope] = useState<FindScope | null>(null);
  const [running, setRunning] = useState(false);
  const [found, setFound] = useState<FindSourcesResult | null>(null);
  const [searchHits, setSearchHits] = useState<RecordSearchResult | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const [reviewed, setReviewed] = useState<Record<string, "confirmed" | "discarded">>({});
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [justKept, setJustKept] = useState<string | null>(null);

  // Where this page was opened from. Another surface can say so in the link.
  const entryRef = useRef<"nav" | "peek" | "upload">(search.entry ?? "nav");
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !profile?.org_id || isCoach) return;
    opened.current = true;
    logEvent("findit.opened", profile.org_id, { entry: entryRef.current });
  }, [profile?.org_id, isCoach]);

  const runFindSources = useServerFn(findSourcesFn);
  const runSearchRecord = useServerFn(searchRecordFn);
  const runReviewLink = useServerFn(reviewLinkFn);

  // A file just dropped here is not mapped anywhere yet, so the first look
  // goes across everything the person has.
  const [autoRun, setAutoRun] = useState(false);
  useEffect(() => {
    if (!autoRun || !targetId || running) return;
    if (!traceable.some((item) => item.id === targetId)) return;
    setAutoRun(false);
    void runSources();
  }, [autoRun, targetId, running, traceable]);

  async function onDrop(files: File[]) {
    const readable = files.filter(isReadableFile);
    if (readable.length === 0) {
      toast(UNREADABLE_FILE_MESSAGE);
      return;
    }
    const ids = await capture(readable);
    const first = ids[0];
    if (!first) return;
    setMode("sources");
    setTargetId(first);
    setScope("all_mine");
    setFound(null);
    if (profile?.org_id) logEvent("findit.opened", profile.org_id, { entry: "upload" });
    setAutoRun(true);
  }

  const target = useMemo(
    () => traceable.find((item) => item.id === targetId) ?? null,
    [traceable, targetId],
  );
  const targetMapped = (target?.work_item_tasks?.length ?? 0) > 0;
  const effectiveScope: FindScope = scope ?? (targetMapped ? "engagement" : "all_mine");

  const quoted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!found || !profile?.org_id) return;
    for (const link of found.links) {
      if (quoted.current.has(link.link_id)) continue;
      quoted.current.add(link.link_id);
      logEvent("findit.quote_shown", profile.org_id, { had_quote: link.quote !== null });
    }
  }, [found, profile?.org_id]);

  const candidates = useMemo(
    () =>
      (found?.links ?? []).map((link) => ({
        link,
        item: items.find((item) => item.id === link.from_item_id) ?? null,
      })),
    [found, items],
  );

  const stillDraft = candidates.filter(
    ({ link }) => (reviewed[link.link_id] ?? link.status) === "draft",
  );

  async function runSources() {
    if (!target || running) return;
    const timer = perfTimer("findit.run", "cold");
    setRunning(true);
    setFound(null);
    quoted.current = new Set();
    try {
      const result = await runFindSources({
        data: {
          target_item_id: target.id,
          scope: effectiveScope,
          profile_id: profile?.id,
        },
      });
      setFound(result);
      setReviewed({});
      if (profile?.org_id) {
        logEvent("findit.run", profile.org_id, {
          scope: effectiveScope,
          considered: linkBucket(result.considered),
          found: linkBucket(result.links.length),
        });
      }
      timer.done();
    } catch (error) {
      timer.cancel();
      toast(error instanceof Error ? error.message : "That did not go through. Try again.");
    } finally {
      setRunning(false);
    }
  }

  async function runSearch() {
    const text = query.trim();
    if (!text || running || mode === "sources") return;
    setRunning(true);
    setSearchHits(null);
    try {
      const result = await runSearchRecord({
        data: { query: text, mode, profile_id: profile?.id },
      });
      setSearchHits(result);
      setSearchedFor(text);
      if (profile?.org_id) {
        logEvent("findit.searched", profile.org_id, {
          mode,
          result_band: linkBucket(result.turns.length + result.deliverables.length),
        });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "That did not go through. Try again.");
    } finally {
      setRunning(false);
    }
  }

  async function review(linkId: string, action: "confirmed" | "discarded") {
    setReviewed((prev) => ({ ...prev, [linkId]: action }));
    if (action === "confirmed") setJustKept(linkId);
    try {
      await runReviewLink({
        data: { link_id: linkId, action, surface: "find_it", profile_id: profile?.id },
      });
    } catch {
      setReviewed((prev) => {
        const next = { ...prev };
        delete next[linkId];
        return next;
      });
      toast("That did not save. Try again.");
    }
  }

  async function keepAll() {
    for (const { link } of stillDraft) await review(link.link_id, "confirmed");
  }

  const readingCount = found?.considered ?? chats.length;

  return (
    <div>
      <PageHeader
        title="Find"
        italicWord="it"
        subtitle="Look back through your own conversations for the ones behind a piece of work, a number, or a thread you lost."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <section className="mb-8">
            <div className="relative">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && mode !== "sources") void runSearch();
                }}
                placeholder="What are you looking for?"
                aria-label="What are you looking for?"
                className="h-12 pr-[68px] font-hand text-[16px]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 opacity-70 sm:block"
              >
                <NotebookSpider size={44} />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {MODE_CHIPS.map((chip) => (
                <button
                  key={chip.mode}
                  type="button"
                  onClick={() => setMode(chip.mode)}
                  className={chipClass(mode === chip.mode)}
                  aria-pressed={mode === chip.mode}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </section>

          {mode === "sources" ? (
            <>
              <section className="mb-8">
                <SectionHeader title="What are you tracing?" />
                {target ? (
                  <div className="mt-3 flex flex-wrap items-start gap-3">
                    <div className="w-[240px]">
                      <WorkNote item={target} />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTargetId(null);
                        setFound(null);
                      }}
                    >
                      Choose something else
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void onDrop(Array.from(event.dataTransfer.files));
                    }}
                    className="mt-3 grid min-h-[140px] place-items-center rounded-[8px] border border-dashed border-pencil bg-card px-6 py-8 text-center"
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {capturing
                          ? "Bringing it in…"
                          : "drop a document, deck or transcript here to find what fed it"}
                      </p>
                      <Button
                        type="button"
                        className="mt-3"
                        onClick={() => setPickerOpen(true)}
                        disabled={isLoading || capturing}
                      >
                        Pick a piece of work
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScope("engagement")}
                    className={chipClass(effectiveScope === "engagement")}
                    aria-pressed={effectiveScope === "engagement"}
                  >
                    This engagement
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("all_mine")}
                    className={chipClass(effectiveScope === "all_mine")}
                    aria-pressed={effectiveScope === "all_mine"}
                  >
                    Everything I have
                  </button>
                  <Button
                    type="button"
                    onClick={() => void runSources()}
                    disabled={!target || running}
                  >
                    {running ? "Looking…" : "Find it"}
                  </Button>
                  {!target ? (
                    <span className="text-[11.5px] text-muted-foreground">
                      Choose a piece of work first.
                    </span>
                  ) : null}
                </div>
                {running ? (
                  <p className="mt-2 flex items-center gap-2 font-hand text-[16px] text-soft">
                    <NotebookSpider size={22} reading={!reduceMotion} />
                    reading {readingCount} conversations
                  </p>
                ) : null}
              </section>

              {running ? (
                <section className="mb-10">
                  <FindItSheet
                    phase="reading"
                    reduce={reduceMotion}
                    target={target ? <WorkNote item={target} /> : null}
                    candidates={chats.slice(0, 12).map((chat) => ({
                      id: chat.id,
                      node: <WorkNote item={chat} />,
                    }))}
                  />
                </section>
              ) : null}

              {found && !running ? (
                <section className="mb-10">
                  <SectionHeader title="What it found" />
                  <div className="mt-4">
                    <FindItSheet
                      phase="found"
                      reduce={reduceMotion}
                      target={target ? <WorkNote item={target} /> : null}
                      candidates={candidates
                        .filter(
                          ({ link }) => (reviewed[link.link_id] ?? link.status) !== "discarded",
                        )
                        .map(({ link, item }) => {
                          const status = reviewed[link.link_id] ?? link.status;
                          return {
                            id: link.link_id,
                            node: (
                              <div
                                className={
                                  justKept === link.link_id ? "nb-findit-settle" : undefined
                                }
                              >
                                {item ? (
                                  <WorkNote item={item} onOpen={() => setOpenThread(item.id)} />
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    A conversation you can no longer read.
                                  </p>
                                )}
                                <p className="micro-label mt-1">{link.relation}</p>
                                {link.quote ? (
                                  <ToneCard tone="claim" className="mt-2 gap-1 p-3">
                                    <p className="font-mono text-[11.5px] leading-5">
                                      {link.quote.text}
                                    </p>
                                    <p className="font-hand text-[16px] text-green">
                                      why: this sentence is in both
                                    </p>
                                  </ToneCard>
                                ) : (
                                  <p className="mt-2 font-hand text-[16px] text-soft">
                                    no exact sentence shared
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-2">
                                  {status === "confirmed" ? (
                                    <span className="flex items-center gap-1 text-[11.5px] text-green">
                                      <span
                                        className={
                                          justKept === link.link_id ? keptMotion.className : ""
                                        }
                                      >
                                        <GraphiteCheck seed={link.link_id} />
                                      </span>{" "}
                                      Kept
                                    </span>
                                  ) : (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void review(link.link_id, "confirmed")}
                                      >
                                        Keep as a source
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void review(link.link_id, "discarded")}
                                      >
                                        Not this one
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ),
                          };
                        })}
                    />
                    {candidates.length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Nothing of yours reads as a source for this one.
                      </p>
                    ) : null}
                  </div>

                  {stillDraft.length > 0 ? (
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <Button type="button" onClick={() => void keepAll()}>
                        Keep all {stillDraft.length}
                      </Button>
                      <span className="font-hand text-[16px] text-soft">
                        goes on the record of this {target?.type ?? "piece of work"}
                      </span>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <section className="mb-10">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void runSearch()}
                  disabled={running || !query.trim()}
                >
                  {running ? "Looking…" : "Find it"}
                </Button>
                <span className="font-hand text-[16px] text-soft">
                  {mode === "number"
                    ? "a number without its conversation is a guess"
                    : "found by what was said, not by title"}
                </span>
              </div>

              {searchHits ? (
                <div className="mt-6">
                  {searchHits.turns.length === 0 && searchHits.deliverables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing with those words. Try fewer of them.
                    </p>
                  ) : null}
                  {searchHits.turns.length > 0 ? (
                    <ul className="divide-y divide-hairline border-t border-hairline">
                      {searchHits.turns.map((hit, index) => (
                        <li
                          key={`${hit.work_item_id}-${hit.turn_no}`}
                          className={`flex items-start gap-4 py-3 ${rowMotion.className}`}
                          style={{ ["--nb-i" as string]: index } as React.CSSProperties}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-foreground">
                              {hit.title}
                              {hit.vendor ? (
                                <span className="micro-label ml-2">{hit.vendor}</span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                              <Highlighted text={hit.excerpt} needle={searchedFor} />
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpenThread(hit.work_item_id)}
                          >
                            Open
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {searchHits.deliverables.length > 0 ? (
                    <div className="mt-5">
                      <p className="micro-label">ALSO IN</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {searchHits.deliverables.map((item) => (
                          <span
                            key={item.work_item_id}
                            className="rounded-[6px] border border-hairline bg-card px-3 py-1.5 text-[13px] text-foreground"
                          >
                            {item.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}
        </div>

        <aside className="space-y-2">
          <ToneCard tone="paper" label="WHAT THIS DOES" className="gap-2 p-4">
            <p>
              Looks across your own conversations. Nothing leaves your record. Keep what fits,
              ignore the rest.
            </p>
          </ToneCard>
          <p className="font-hand text-[16px] text-green">your coach never sees this page</p>
        </aside>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pick a piece of work</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {traceable.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTargetId(item.id);
                  setScope(null);
                  setFound(null);
                  setPickerOpen(false);
                }}
                className="block w-full truncate rounded-md px-2 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-accent-soft"
              >
                {item.title}
                <span className="ml-2 text-muted-foreground">
                  {formatDate(effectiveWorkDate(item))}
                </span>
              </button>
            ))}
            {traceable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing to trace yet. Documents, decks, sheets and call transcripts appear here.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ThreadViewerById workItemId={openThread} onClose={() => setOpenThread(null)} />
    </div>
  );
}
