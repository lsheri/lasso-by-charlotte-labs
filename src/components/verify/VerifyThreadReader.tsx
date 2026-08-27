/**
 * PASS 128 — "What to fact check", full screen.
 *
 * The conversation on the left, the checklist on the right, and one short
 * story on opening that draws a reading trail down the transcript and settles
 * the ink on every flagged claim as it passes. After that the reader walks at
 * the reader's own pace: nothing moves on its own again.
 *
 * Owner only. A coach never reaches this surface, and the component renders
 * null for one even if it is somehow mounted.
 */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { DrawnCheck, DrawnStrike, PencilFirework, useMark } from "@/components/notebook/marks";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { SpanLegend } from "@/components/provenance/SpanLegend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  closeVerifyThread,
  markStoryPlayed,
  storyPlayed,
  useVerifyThread,
  type VerifyThreadRequest,
} from "@/components/verify/verify-thread-state";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { chatUrlLabel, effectiveChatUrl } from "@/lib/chat-url";
import { confirmHandoffItem, discardHandoffItem, loadHandoffs } from "@/lib/handoffs.functions";
import type { HandoffItem, OpenCheckItem } from "@/lib/handoffs-shared";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";
import {
  VERIFY_ALL_SETTLED_LINE,
  VERIFY_CARRY_LINE,
  VERIFY_LEGEND,
  VERIFY_SOURCE_NO_LINK,
  VERIFY_SOURCE_STEPS,
  VERIFY_SOURCE_TITLE,
  VERIFY_SOURCE_WHY,
  VERIFY_THREAD_EMPTY_LINE,
  VERIFY_THREAD_LABEL,
  checkBadgeText,
  sourcePrompt,
  turnAnchorId,
  verdictInk,
  verdictPhrase,
  verifyFindings,
  type ThreadMark,
} from "@/lib/verify-thread-shared";
import type { WorkItemRow } from "@/lib/work-types";

const SKIP_KEY = "lasso.reader.skip_story";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function readSkipPreference(): boolean {
  try {
    return window.localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSkipPreference(): void {
  try {
    window.localStorage.setItem(SKIP_KEY, "1");
  } catch {
    /* a preference that cannot be stored is simply not stored */
  }
}

type Outcome = "completed" | "skipped" | "suppressed";

/**
 * The intro story. One downward pass, at most five seconds, every timer and
 * frame handle owned here so a skip or an unmount can end all of it at once.
 */
function useReaderStory({
  enabled,
  reduced,
  scroller,
  turnNos,
  ids,
  onResolved,
}: {
  enabled: boolean;
  reduced: boolean;
  scroller: React.RefObject<HTMLDivElement | null>;
  turnNos: readonly number[];
  ids: readonly string[];
  onResolved: (outcome: Outcome) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [progress, setProgress] = useState(0);
  const [tipY, setTipY] = useState(0);
  const [firework, setFirework] = useState(false);
  const timers = useRef<number[]>([]);
  const frame = useRef<number | null>(null);
  const started = useRef(false);
  const resolved = useRef(false);

  const clearAll = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const finalState = useCallback(() => {
    setSettled(new Set(ids));
    setProgress(1);
    setPlaying(false);
    setFirework(true);
  }, [ids]);

  const resolve = useCallback(
    (outcome: Outcome) => {
      if (resolved.current) return;
      resolved.current = true;
      onResolved(outcome);
    },
    [onResolved],
  );

  const skip = useCallback(() => {
    if (!playing) return;
    clearAll();
    finalState();
    writeSkipPreference();
    const node = scroller.current;
    const first = turnNos[0];
    if (node && first !== undefined) {
      const anchor = node.querySelector<HTMLElement>(`#${CSS.escape(turnAnchorId(first))}`);
      if (anchor) node.scrollTop = Math.max(anchor.offsetTop - 40, 0);
    }
    resolve("skipped");
  }, [clearAll, finalState, playing, resolve, scroller, turnNos]);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    const node = scroller.current;

    if (reduced || ids.length === 0 || !node) {
      finalState();
      const first = turnNos[0];
      if (node && first !== undefined) {
        const anchor = node.querySelector<HTMLElement>(`#${CSS.escape(turnAnchorId(first))}`);
        if (anchor) node.scrollTop = Math.max(anchor.offsetTop - 40, 0);
      }
      resolve("suppressed");
      return;
    }

    const tops = new Map<string, number>();
    ids.forEach((id, index) => {
      const turnNo = turnNos[index];
      if (turnNo === undefined) return;
      const anchor = node.querySelector<HTMLElement>(`#${CSS.escape(turnAnchorId(turnNo))}`);
      if (anchor) tops.set(id, anchor.offsetTop);
    });

    const maxScroll = Math.max(node.scrollHeight - node.clientHeight, 0);
    const lastTop = Math.max(...[...tops.values(), 0]);
    const end = Math.min(maxScroll, Math.max(lastTop - 40, 0));
    const height = maxScroll;
    const duration = Math.min(Math.max(1400, height * 0.9), 3200);
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const seen = new Set<string>();
    const start = performance.now();
    setPlaying(true);

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = ease(t);
      node.scrollTop = end * eased;
      setProgress(t);
      setTipY(node.clientHeight * Math.min(eased + 0.05, 1));
      const passed = node.scrollTop + node.clientHeight * 0.6;
      for (const [id, top] of tops) {
        if (seen.has(id) || top > passed) continue;
        seen.add(id);
        setSettled(new Set(seen));
        if (id === ids[0]) {
          timers.current.push(window.setTimeout(() => setFirework(true), 100));
        }
      }
      if (t < 1) {
        frame.current = window.requestAnimationFrame(step);
        return;
      }
      frame.current = null;
      setSettled(new Set(ids));
      setPlaying(false);
      setFirework(true);
      resolve("completed");
    };
    frame.current = window.requestAnimationFrame(step);
  }, [enabled, finalState, ids, reduced, resolve, scroller, turnNos]);

  useEffect(() => clearAll, [clearAll]);

  return { playing, settled, progress, tipY, firework, skip };
}

function SettledRow({ item }: { item: HandoffItem }) {
  const fields = item.fields as OpenCheckItem;
  const carried = typeof fields.carried_from_run_id === "string";
  return (
    <li className="text-[11px] leading-snug text-muted-foreground opacity-70">
      <span className="block">
        {fields.claim_quote.slice(0, 80)}
        {fields.claim_quote.length > 80 ? "..." : ""}
      </span>
      <span className="block">
        {item.state === "confirmed" ? "Checked it myself" : "Doesn't need checking"}
        {carried ? " · Settled in a previous run" : ""}
      </span>
      {fields.self_check_note ? <span className="block">{fields.self_check_note}</span> : null}
    </li>
  );
}

function ReaderBody({ request }: { request: VerifyThreadRequest }) {
  const { data: profile } = useProfile();
  const load = useServerFn(loadHandoffs);
  const confirmItem = useServerFn(confirmHandoffItem);
  const discardItem = useServerFn(discardHandoffItem);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<HandoffItem[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const check = useMark();
  const strike = useMark();
  const reduced = prefersReducedMotion();
  const alreadyPlayed = useMemo(() => storyPlayed(request.runId), [request.runId]);
  const [sourceOpen, setSourceOpen] = useState(!alreadyPlayed);

  const isCoach = profile?.role === "coach";

  const itemQuery = useQuery({
    queryKey: ["verify-thread-item", request.itemId],
    enabled: Boolean(profile) && !isCoach,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_items")
        .select("*")
        .eq("id", request.itemId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as WorkItemRow | null;
    },
  });

  const findingsQuery = useQuery({
    queryKey: ["verify-thread-findings", request.runId, profile?.id],
    enabled: Boolean(profile) && !isCoach,
    queryFn: async () => {
      const result = await load({ data: { run_id: request.runId, profile_id: profile!.id } });
      return result.block?.items ?? [];
    },
  });

  const allItems = items ?? findingsQuery.data ?? [];
  const findings = useMemo(() => verifyFindings(allItems), [allItems]);
  const drafts = useMemo(() => findings.filter((f) => f.state === "draft"), [findings]);
  const settledItems = useMemo(
    () =>
      allItems.filter(
        (item) =>
          item.state !== "draft" && typeof (item.fields as OpenCheckItem).claim_quote === "string",
      ),
    [allItems],
  );
  const carriedCount = settledItems.filter(
    (item) => typeof (item.fields as OpenCheckItem).carried_from_run_id === "string",
  ).length;

  const marks: ThreadMark[] = useMemo(
    () =>
      findings.map((finding) => ({
        id: finding.id,
        turnNo: Number(finding.fields.evidence_turn_id),
        quote: finding.fields.claim_quote,
        verdict: finding.fields.verdict,
        bold: finding.state === "draft",
      })),
    [findings],
  );

  const orderedIds = useMemo(() => findings.map((f) => f.id), [findings]);
  const orderedTurns = useMemo(
    () => findings.map((f) => Number(f.fields.evidence_turn_id)),
    [findings],
  );

  const onResolved = useCallback(
    (outcome: Outcome) => {
      markStoryPlayed(request.runId);
      if (profile?.org_id) {
        logEvent("analysis.reader_story", profile.org_id, { outcome });
      }
    },
    [profile?.org_id, request.runId],
  );

  const storyEnabled =
    Boolean(profile) &&
    !isCoach &&
    !itemQuery.isLoading &&
    !findingsQuery.isLoading &&
    Boolean(itemQuery.data);

  const suppressed = reduced || alreadyPlayed || readSkipPreference() || findings.length === 0;

  const story = useReaderStory({
    enabled: storyEnabled,
    reduced: suppressed,
    scroller,
    turnNos: orderedTurns,
    ids: orderedIds,
    onResolved,
  });

  const goTo = useCallback(
    (id: string) => {
      const finding = findings.find((f) => f.id === id);
      if (!finding) return;
      setActiveId(id);
      const node = scroller.current;
      const anchor = document.getElementById(
        turnAnchorId(Number(finding.fields.evidence_turn_id)),
      );
      if (node && anchor) {
        node.scrollTo({
          top: Math.max(anchor.offsetTop - 40, 0),
          behavior: reduced ? "auto" : "smooth",
        });
      }
      if (profile) {
        logV2(
          "evidence.opened",
          { surface: "verify_thread_rail", item_type: "ai_thread" },
          { profileId: profile.id, workItemId: request.itemId },
        );
      }
    },
    [findings, profile, reduced, request.itemId],
  );

  const settle = useCallback(
    async (id: string, kind: "confirm" | "discard") => {
      if (!profile || pending) return;
      setPending(true);
      if (kind === "confirm") check.fire(id);
      else strike.fire(id);
      try {
        const base = { run_id: request.runId, profile_id: profile.id };
        const result =
          kind === "confirm"
            ? await confirmItem({
                data: {
                  ...base,
                  item_id: id,
                  self_check: true,
                  ...(notes[id]?.trim() ? { note: notes[id]!.trim().slice(0, 200) } : {}),
                },
              })
            : await discardItem({ data: { ...base, item_id: id } });
        if (result.block) setItems(result.block.items);
      } finally {
        setPending(false);
      }
    },
    [check, confirmItem, discardItem, notes, pending, profile, request.runId, strike],
  );

  const item = itemQuery.data ?? null;
  const loading = itemQuery.isLoading || findingsQuery.isLoading;
  const sourceUrl = effectiveChatUrl(
    item?.source_meta?.url,
    item?.source_vendor ?? null,
    item?.orig_conversation_id ?? null,
  );
  const promptText = useMemo(
    () => sourcePrompt(drafts.map((d) => d.fields.claim_quote)),
    [drafts],
  );

  const copyPrompt = useCallback(() => {
    void navigator.clipboard?.writeText(promptText).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => undefined,
    );
  }, [promptText]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (story.playing) story.skip();
      else closeVerifyThread();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [story]);

  if (!profile || isCoach) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-background"
      data-testid="verify-thread-reader"
      onClick={() => {
        if (story.playing) story.skip();
      }}
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="micro-label text-muted-foreground">{VERIFY_THREAD_LABEL}</p>
          <h1 className="page-title mt-1 break-words text-[20px] leading-snug">
            {request.itemTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {drafts.length > 0 ? (
            <span className="nb-check-badge" data-testid="verify-badge-header">
              {checkBadgeText(drafts.length)}
            </span>
          ) : null}
          {story.playing ? (
            <button
              type="button"
              data-testid="verify-skip"
              onClick={() => story.skip()}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip the story
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Close the reader"
            onClick={closeVerifyThread}
            className="grid h-9 w-9 place-items-center rounded-md text-foreground/70 transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="nb-reader-grid min-h-0 flex-1">
        <div
          ref={scroller}
          data-testid="verify-thread-transcript"
          className="nb-reader-transcript relative px-5 py-5"
        >
          {story.progress > 0 ? (
            <svg
              className="nb-reader-trail"
              aria-hidden
              data-testid="verify-reader-trail"
              preserveAspectRatio="none"
              viewBox="0 0 18 100"
            >
              <path d={`M 9 0 Q 12 ${50 * story.progress} 9 ${100 * story.progress}`} />
            </svg>
          ) : null}
          {story.playing && !reduced ? (
            <span
              className="nb-dots pointer-events-none absolute left-1 top-0"
              style={{ transform: `translateY(${story.tipY}px)` }}
              aria-hidden
            >
              <span className="nb-dot" />
              <span className="nb-dot" />
              <span className="nb-dot" />
            </span>
          ) : null}
          {story.firework && findings[0] ? (
            <span className="pointer-events-none absolute right-4 top-4">
              <PencilFirework nodeId={findings[0].id} drawing={!reduced} />
            </span>
          ) : null}
          {item ? (
            <ThreadBody
              item={item}
              marks={marks}
              activeMarkId={activeId}
              settledIds={story.settled}
              onMarkActivate={goTo}
              reducedMotion={reduced}
            />
          ) : null}
        </div>

        <aside data-testid="verify-thread-rail" className="nb-reader-rail flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="micro-label text-muted-foreground">{VERIFY_THREAD_LABEL}</p>
            {drafts.length > 0 ? (
              <span className="nb-check-badge" data-testid="verify-badge-rail">
                {checkBadgeText(drafts.length)}
              </span>
            ) : null}
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground">Reading the record...</p>
          ) : findings.length === 0 && settledItems.length === 0 ? (
            <p
              data-testid="verify-thread-empty"
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              {VERIFY_THREAD_EMPTY_LINE}
            </p>
          ) : (
            <>
              {carriedCount > 0 && drafts.length > 0 ? (
                <p className="text-[11px] leading-snug text-muted-foreground">{VERIFY_CARRY_LINE}</p>
              ) : null}

              <ol className="flex flex-col gap-2">
                {drafts.map((finding) => {
                  const ink = verdictInk(finding.fields.verdict);
                  return (
                    <li
                      key={finding.id}
                      className={`relative rounded-[var(--radius)] border border-border bg-card p-3 shadow-card ${
                        story.settled.has(finding.id) && !reduced ? "nb-rise" : ""
                      }`}
                      data-active={activeId === finding.id ? "true" : "false"}
                      data-testid={`verify-finding-${finding.id}`}
                    >
                      {check.markId === finding.id ? (
                        <span className="pointer-events-none absolute right-2 top-2">
                          <DrawnCheck key={check.markKey} />
                        </span>
                      ) : null}
                      {strike.markId === finding.id ? <DrawnStrike key={strike.markKey} /> : null}
                      <button
                        type="button"
                        onClick={() => goTo(finding.id)}
                        className="block w-full text-left"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: ink.stroke }}
                          />
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {verdictPhrase(finding.fields.verdict)}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-snug text-foreground">
                          {finding.fields.claim_quote}
                        </span>
                        <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                          {finding.fields.suggested_check}
                        </span>
                      </button>
                      <Input
                        value={notes[finding.id] ?? ""}
                        maxLength={200}
                        placeholder="How you checked it, one line. Optional."
                        onChange={(event) =>
                          setNotes((prev) => ({ ...prev, [finding.id]: event.target.value }))
                        }
                        className="mt-2 h-9 text-xs"
                      />
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="sm"
                          className="min-h-11 sm:min-h-9"
                          disabled={pending}
                          onClick={() => void settle(finding.id, "confirm")}
                        >
                          Checked it myself
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-11 sm:min-h-9"
                          disabled={pending}
                          onClick={() => void settle(finding.id, "discard")}
                        >
                          Doesn't need checking
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {drafts.length === 0 ? (
                <p className="text-xs text-muted-foreground">{VERIFY_ALL_SETTLED_LINE}</p>
              ) : null}

              {settledItems.length > 0 ? (
                <details className="rounded-[var(--radius)] border border-border p-2">
                  <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Settled ({settledItems.length})
                  </summary>
                  <ul className="mt-2 space-y-2" data-testid="verify-settled">
                    {settledItems.map((settledItem) => (
                      <SettledRow key={settledItem.id} item={settledItem} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}

          <section
            className="mt-2 rounded-[var(--radius)] border border-border p-3"
            data-testid="verify-source-block"
          >
            <button
              type="button"
              onClick={() => setSourceOpen((open) => !open)}
              className="w-full text-left font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              {VERIFY_SOURCE_TITLE}
            </button>
            {sourceOpen ? (
              <div className="mt-2 space-y-2">
                <Button size="sm" variant="outline" onClick={copyPrompt}>
                  {copied ? "Copied" : "Copy the prompt"}
                </Button>
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={copyPrompt}
                    className="block text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                  >
                    {chatUrlLabel(sourceUrl)}
                  </a>
                ) : (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {VERIFY_SOURCE_NO_LINK}
                  </p>
                )}
                <ol className="space-y-1">
                  {VERIFY_SOURCE_STEPS.map((step) => (
                    <li key={step} className="text-[11px] leading-snug text-muted-foreground">
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] leading-snug text-muted-foreground">{VERIFY_SOURCE_WHY}</p>
              </div>
            ) : null}
          </section>

          <ul
            data-testid="verify-thread-legend"
            className="flex flex-col gap-1 border-t border-border pt-2"
          >
            {VERIFY_LEGEND.map((entry) => (
              <li
                key={entry.verdict}
                className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: verdictInk(entry.verdict).stroke }}
                />
                {entry.phrase}
              </li>
            ))}
          </ul>
          <SpanLegend />
        </aside>
      </div>
    </div>
  );
}

export function VerifyThreadReader() {
  const request = useVerifyThread();
  if (!request) return null;
  return <ReaderBody key={request.runId} request={request} />;
}
