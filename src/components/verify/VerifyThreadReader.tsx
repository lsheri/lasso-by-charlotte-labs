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
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { readingTrailD } from "@/lib/journey-path";
import { DrawnCheck, DrawnStrike, PencilFirework, useMark } from "@/components/notebook/marks";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { TurnCardStory } from "@/components/verify/TurnCardStory";
import { SpanLegend } from "@/components/provenance/SpanLegend";
import { AddDecisionDialog } from "@/components/decisions/AddDecisionDialog";
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
import { DECIDED_LABEL } from "@/lib/analysis-presets";
import { chatUrlLabel, effectiveChatUrl } from "@/lib/chat-url";
import { confirmHandoffItem, discardHandoffItem, loadHandoffs } from "@/lib/handoffs.functions";
import type { DecisionCandidateItem, HandoffItem, OpenCheckItem } from "@/lib/handoffs-shared";
import {
  DECISIONS_ALL_SETTLED_LINE,
  DECISIONS_CHANGED_LINE,
  DECISIONS_CONFIRM_LABEL,
  DECISIONS_DISCARD_LABEL,
  DECISIONS_EMPTY_LINE,
  DECISIONS_RAIL_HEADING,
  DECISIONS_UNTRACEABLE_LINE,
  ORIGIN_CHIP,
  decisionFindings,
  decisionsPhaseLines,
  originClass,
} from "@/lib/decisions-thread-shared";
import { logEvent } from "@/lib/telemetry";
import type { TurnStoryTurn } from "@/lib/turn-story-shared";
import { logV2 } from "@/lib/telemetry-v2";
import {
  VERIFY_ALL_SETTLED_LINE,
  VERIFY_CARRY_LINE,
  VERIFY_CHECK_LABEL,
  VERIFY_LEGEND,
  VERIFY_SOURCE_NO_LINK,
  VERIFY_SOURCE_STEPS,
  VERIFY_SOURCE_TITLE,
  VERIFY_SOURCE_WHY,
  VERIFY_THREAD_EMPTY_LINE,
  VERIFY_THREAD_LABEL,
  VERIFY_WORKING_LINE,
  RESOLVE_GRACE_MS,
  checkBadgeText,
  verifyPhaseLines,
  reviewBadgeText,
  sourcePrompt,
  turnAnchorId,
  verdictInk,
  verdictPhrase,
  verifyFindings,
  type ThreadMark,
} from "@/lib/verify-thread-shared";
import { advanceScroll, type ScrollState } from "@/lib/working-scroll";
import type { WorkItemRow } from "@/lib/work-types";

const RAIL_WIDE_KEY = "lasso.reader.rail_wide";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

// PASS 134: the settle story plays on every open. Skipping stops THIS showing
// and nothing else: no preference is written, nothing is remembered.


/**
 * PASS 131 — how wide the rail sits. Narrow by default, and remembered, because
 * a checklist you widened once you want widened next time too.
 */
function useRailWide(): [boolean, () => void] {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    try {
      setWide(window.localStorage.getItem(RAIL_WIDE_KEY) === "1");
    } catch {
      /* no preference is simply the default */
    }
  }, []);
  const toggle = useCallback(() => {
    setWide((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RAIL_WIDE_KEY, next ? "1" : "0");
      } catch {
        /* a preference that cannot be stored is simply not stored */
      }
      return next;
    });
  }, []);
  return [wide, toggle];
}

function RailWidenButton({ wide, onToggle }: { wide: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="reader-rail-widen"
      aria-label={wide ? "Narrow the checklist" : "Widen the checklist"}
      onClick={onToggle}
      className="nb-rail-widen grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {wide ? (
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
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

/**
 * One call on the decisions rail: the call itself, one origin chip, and the
 * two controls. No verdict, no score, no count, nothing being weighed.
 */
function DecisionRow({
  item,
  active,
  risen,
  pending,
  checkId,
  checkKey,
  strikeId,
  strikeKey,
  onGoTo,
  onSettle,
}: {
  item: HandoffItem & { fields: DecisionCandidateItem };
  active: boolean;
  risen: boolean;
  pending: boolean;
  checkId: string | null | undefined;
  checkKey: number | string;
  strikeId: string | null | undefined;
  strikeKey: number | string;
  onGoTo: (id: string) => void;
  onSettle: (id: string, kind: "confirm" | "discard") => void;
}) {
  const cls = originClass(item.fields);
  return (
    <li
      className={`relative rounded-[var(--radius)] border border-border bg-card p-3 shadow-card ${
        risen ? "nb-rise" : ""
      }`}
      data-active={active ? "true" : "false"}
      data-origin={cls}
      data-testid={`decision-finding-${item.id}`}
    >
      {checkId === item.id ? (
        <span className="pointer-events-none absolute right-2 top-2">
          <DrawnCheck key={checkKey} />
        </span>
      ) : null}
      {strikeId === item.id ? <DrawnStrike key={strikeKey} /> : null}
      <button type="button" onClick={() => onGoTo(item.id)} className="block w-full text-left">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--nb-ink-yellow)" }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {ORIGIN_CHIP[cls]}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-snug text-foreground">{item.fields.call}</span>
        {cls === "model_changed" ? (
          <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
            {DECISIONS_CHANGED_LINE}
          </span>
        ) : null}
      </button>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Button
          size="sm"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
          onClick={() => onSettle(item.id, "confirm")}
        >
          {DECISIONS_CONFIRM_LABEL}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
          onClick={() => onSettle(item.id, "discard")}
        >
          {DECISIONS_DISCARD_LABEL}
        </Button>
      </div>
    </li>
  );
}

/**
 * PASS 131 — the working read-through. The transcript needs no model, so it is
 * on screen at once and the pencil rides slowly down it and loops gently back
 * up while the run happens underneath. The loop never pretends to be progress.
 */
function useWorkingLoop({
  enabled,
  reduced,
  scroller,
}: {
  enabled: boolean;
  reduced: boolean;
  scroller: React.RefObject<HTMLDivElement | null>;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tipY, setTipY] = useState(0);
  const frame = useRef<number | null>(null);
  const stopped = useRef(false);

  const stop = useCallback(() => {
    stopped.current = true;
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!enabled || reduced) return;
    const node = scroller.current;
    if (!node) return;
    stopped.current = false;
    setRunning(true);
    // PASS 133: constant reading speed, both ways. The pace belongs to the
    // reader; the length of the conversation only changes how long a lap takes.
    let state: ScrollState = { pos: node.scrollTop, dir: 1 };
    let last = performance.now();
    const step = (now: number) => {
      if (stopped.current) return;
      const dtMs = Math.min(now - last, 64);
      last = now;
      const maxScroll = Math.max(node.scrollHeight - node.clientHeight, 0);
      state = advanceScroll(state, maxScroll, dtMs);
      node.scrollTop = state.pos;
      const ratio = maxScroll > 0 ? state.pos / maxScroll : 0;
      setProgress(Math.max(ratio, 0.02));
      setTipY(node.clientHeight * Math.min(ratio + 0.05, 1));
      frame.current = window.requestAnimationFrame(step);
    };
    frame.current = window.requestAnimationFrame(step);
    return () => {
      stopped.current = true;
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [enabled, reduced, scroller]);


  return { running, progress, tipY, stop };
}

/** One phase line at a time, advancing on a timer, the last one holding. */
function usePhaseLine(lines: readonly string[], enabled: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    setIndex(0);
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1 < lines.length ? prev + 1 : prev));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [enabled, lines.length]);
  return lines[Math.min(index, lines.length - 1)] ?? "";
}

/**
 * The reader while the run is still going: the same shell, the transcript on
 * the left, and one honest line at a time on the right.
 */
function PendingBody({
  request,
  onSkip,
}: {
  request: VerifyThreadRequest;
  onSkip?: () => void;
}) {
  const { data: profile } = useProfile();
  const scroller = useRef<HTMLDivElement | null>(null);
  const reduced = prefersReducedMotion();
  const [skipped, setSkipped] = useState(false);
  const [wide, toggleWide] = useRailWide();
  const isCoach = profile?.role === "coach";
  const isDecisions = (request.kind ?? "verification") === "decisions";
  const failed = typeof request.error === "string" && request.error.length > 0;

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

  // PASS 132: the same turns the transcript loads, under the same key, so the
  // card story costs no second query.
  const { data: turns } = useQuery({
    queryKey: ["turns", request.itemId],
    enabled: Boolean(profile) && !isCoach,
    queryFn: async (): Promise<TurnStoryTurn[]> => {
      const { data, error } = await supabase
        .from("turns")
        .select("id, turn_no, role, content, ts, model, meta")
        .eq("work_item_id", request.itemId)
        .order("turn_no", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as TurnStoryTurn[];
    },
  });
  const turnCount = turns?.length ?? 0;

  const lines = useMemo(
    () => (isDecisions ? decisionsPhaseLines(turnCount) : verifyPhaseLines(turnCount)),
    [isDecisions, turnCount],
  );
  const phase = usePhaseLine(lines, !skipped && !failed);

  const loop = useWorkingLoop({
    enabled: Boolean(itemQuery.data) && !skipped && !failed,
    reduced,
    scroller,
  });

  useEffect(() => {
    if (skipped || failed) loop.stop();
  }, [failed, loop, skipped]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeVerifyThread();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!profile || isCoach) return null;
  const item = itemQuery.data ?? null;
  const stoppedLine = failed ? request.error : VERIFY_WORKING_LINE;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-background"
      data-testid="verify-thread-reader"
      data-pending="true"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="micro-label text-muted-foreground">
            {isDecisions ? DECIDED_LABEL : VERIFY_THREAD_LABEL}
          </p>
          <h1 className="page-title mt-1 break-words text-[20px] leading-snug">
            {request.itemTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {loop.running && !skipped ? (
            <button
              type="button"
              data-testid="verify-skip"
              onClick={() => {
                setSkipped(true);
                onSkip?.();
              }}
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

      <div className="nb-reader-grid min-h-0 flex-1" data-rail-wide={wide ? "true" : "false"}>
        <div
          ref={scroller}
          data-testid="verify-thread-transcript"
          className="nb-reader-transcript relative px-5 py-5"
        >
          <p
            className="micro-label mb-3 text-muted-foreground"
            data-testid="reader-phase-line"
            aria-live="polite"
          >
            {skipped || failed ? stoppedLine : phase}
          </p>
          {loop.progress > 0 && !skipped && !failed ? (
            <svg
              className="nb-reader-trail"
              aria-hidden
              data-testid="verify-reader-trail"
              preserveAspectRatio="none"
              viewBox="0 0 18 100"
            >
              <path d={readingTrailD(loop.progress)} />
            </svg>
          ) : null}
          {loop.running && !reduced && !skipped && !failed ? (
            <span
              className="nb-dots pointer-events-none absolute left-1 top-0"
              style={{ transform: `translateY(${loop.tipY}px)` }}
              aria-hidden
            >
              <span className="nb-dot" />
              <span className="nb-dot" />
              <span className="nb-dot" />
            </span>
          ) : null}
          {item ? <ThreadBody item={item} reducedMotion={reduced} /> : null}
        </div>

        <aside data-testid="verify-thread-rail" className="nb-reader-rail flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="micro-label text-muted-foreground">
              {isDecisions ? DECISIONS_RAIL_HEADING : VERIFY_THREAD_LABEL}
            </p>
            <RailWidenButton wide={wide} onToggle={toggleWide} />
          </div>
          <p className="text-xs text-muted-foreground" data-testid="reader-rail-phase">
            {skipped || failed ? stoppedLine : phase}
          </p>
          {!skipped && !failed ? (
            <TurnCardStory
              itemId={request.itemId}
              item={item}
              turns={turns ?? []}
              running={loop.running && !skipped && !failed}
              reduced={reduced}
            />
          ) : null}
          {failed ? (
            <Button size="sm" variant="outline" onClick={closeVerifyThread}>
              Close the reader
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}


function ReaderBody({ request }: { request: VerifyThreadRequest & { runId: string } }) {
  const { data: profile } = useProfile();
  const load = useServerFn(loadHandoffs);
  const confirmItem = useServerFn(confirmHandoffItem);
  const discardItem = useServerFn(discardHandoffItem);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<HandoffItem[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prefill, setPrefill] = useState<DecisionCandidateItem | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const check = useMark();
  const strike = useMark();
  const reduced = prefersReducedMotion();
  const [wide, toggleWide] = useRailWide();
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
  const isDecisions = (request.kind ?? "verification") === "decisions";

  const findings = useMemo(() => verifyFindings(allItems), [allItems]);
  const calls = useMemo(() => decisionFindings(allItems), [allItems]);
  const anchored = isDecisions ? calls : findings;
  const drafts = useMemo(
    () => findings.filter((f) => f.state === "draft"),
    [findings],
  );
  const callDrafts = useMemo(() => calls.filter((c) => c.state === "draft"), [calls]);
  const traced = useMemo(
    () => callDrafts.filter((c) => originClass(c.fields) !== "untraceable"),
    [callDrafts],
  );
  const untraced = useMemo(
    () => callDrafts.filter((c) => originClass(c.fields) === "untraceable"),
    [callDrafts],
  );
  const openCount = isDecisions ? callDrafts.length : drafts.length;
  const settledItems = useMemo(
    () =>
      allItems.filter((item) =>
        isDecisions
          ? item.state !== "draft" && typeof (item.fields as DecisionCandidateItem).call === "string"
          : item.state !== "draft" &&
            typeof (item.fields as OpenCheckItem).claim_quote === "string",
      ),
    [allItems, isDecisions],
  );
  const carriedCount = settledItems.filter(
    (item) => typeof (item.fields as OpenCheckItem).carried_from_run_id === "string",
  ).length;

  const marks: ThreadMark[] = useMemo(
    () =>
      isDecisions
        ? calls.map((call) => ({
            id: call.id,
            turnNo: Number(call.fields.evidence_turn_id),
            // No span ink here: a decision candidate carries no quote, and
            // nothing in this reader is being judged.
            quote: "",
            verdict: "",
            lit: true,
            stroke: "var(--nb-ink-yellow)",
            wash: "var(--status-unsourced-wash)",
          }))
        : findings.map((finding) => ({
            id: finding.id,
            turnNo: Number(finding.fields.evidence_turn_id),
            quote: finding.fields.claim_quote,
            verdict: finding.fields.verdict,
            bold: finding.state === "draft",
          })),
    [calls, findings, isDecisions],
  );

  const orderedIds = useMemo(() => anchored.map((f) => f.id), [anchored]);
  const orderedTurns = useMemo(
    () => anchored.map((f) => Number(f.fields.evidence_turn_id)),
    [anchored],
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

  const suppressed = reduced || alreadyPlayed || readSkipPreference() || anchored.length === 0;

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
      const finding = anchored.find((f) => f.id === id);
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
          {
            surface: isDecisions ? "decisions_thread_rail" : "verify_thread_rail",
            item_type: "ai_thread",
          },
          { profileId: profile.id, workItemId: request.itemId },
        );
      }
    },
    [anchored, isDecisions, profile, reduced, request.itemId],
  );

  const settle = useCallback(
    async (id: string, kind: "confirm" | "discard") => {
      if (!profile || pending) return;
      setPending(true);
      if (kind === "confirm") check.fire(id);
      else strike.fire(id);
      try {
        const base = { run_id: request.runId, profile_id: profile.id };
        // A confirmed call opens the decision drafter, exactly as the drafts
        // list does. A confirmed claim is a self check, and goes nowhere else.
        if (kind === "confirm" && isDecisions) {
          const found = calls.find((c) => c.id === id);
          if (found) setPrefill(found.fields);
        }
        const result =
          kind === "confirm"
            ? await confirmItem({
                data: {
                  ...base,
                  item_id: id,
                  ...(isDecisions ? {} : { self_check: true }),
                  ...(!isDecisions && notes[id]?.trim()
                    ? { note: notes[id]!.trim().slice(0, 200) }
                    : {}),
                },
              })
            : await discardItem({ data: { ...base, item_id: id } });
        if (result.block) setItems(result.block.items);
      } finally {
        setPending(false);
      }
    },
    [
      calls,
      check,
      confirmItem,
      discardItem,
      isDecisions,
      notes,
      pending,
      profile,
      request.runId,
      strike,
    ],
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
          <p className="micro-label text-muted-foreground">
            {isDecisions ? DECIDED_LABEL : VERIFY_THREAD_LABEL}
          </p>
          <h1 className="page-title mt-1 break-words text-[20px] leading-snug">
            {request.itemTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {openCount > 0 ? (
            <span className="nb-check-badge" data-testid="verify-badge-header">
              {isDecisions ? reviewBadgeText(openCount) : checkBadgeText(openCount)}
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

      <div className="nb-reader-grid min-h-0 flex-1" data-rail-wide={wide ? "true" : "false"}>
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
              <path d={readingTrailD(story.progress)} />
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
          {story.firework && anchored[0] ? (
            <span className="pointer-events-none absolute right-4 top-4">
              <PencilFirework nodeId={anchored[0].id} drawing={!reduced} />
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
            <p className="micro-label text-muted-foreground">
              {isDecisions ? DECISIONS_RAIL_HEADING : VERIFY_THREAD_LABEL}
            </p>
            <div className="flex items-center gap-2">
              {openCount > 0 ? (
                <span className="nb-check-badge" data-testid="verify-badge-rail">
                  {isDecisions ? reviewBadgeText(openCount) : checkBadgeText(openCount)}
                </span>
              ) : null}
              <RailWidenButton wide={wide} onToggle={toggleWide} />
            </div>
          </div>

          {isDecisions ? (
            loading ? (
              <p className="text-xs text-muted-foreground">Reading the record...</p>
            ) : calls.length === 0 && settledItems.length === 0 ? (
              <p
                data-testid="decisions-thread-empty"
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
              >
                {DECISIONS_EMPTY_LINE}
              </p>
            ) : (
              <>
                {carriedCount > 0 && callDrafts.length > 0 ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {VERIFY_CARRY_LINE}
                  </p>
                ) : null}
                <ol className="flex flex-col gap-2" data-testid="decisions-thread-list">
                  {traced.map((call) => (
                    <DecisionRow
                      key={call.id}
                      item={call}
                      active={activeId === call.id}
                      risen={story.settled.has(call.id) && !reduced}
                      pending={pending}
                      checkId={check.markId}
                      checkKey={check.markKey}
                      strikeId={strike.markId}
                      strikeKey={strike.markKey}
                      onGoTo={goTo}
                      onSettle={settle}
                    />
                  ))}
                </ol>
                {untraced.length > 0 ? (
                  <ul data-testid="decisions-untraceable" className="flex flex-col gap-2">
                    {untraced.map((call) => (
                      <li
                        key={call.id}
                        className="rounded-[var(--radius)] border border-dashed border-border p-2 opacity-80"
                      >
                        <span className="block text-xs leading-snug text-foreground">
                          {call.fields.call}
                        </span>
                        <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                          {DECISIONS_UNTRACEABLE_LINE}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {callDrafts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{DECISIONS_ALL_SETTLED_LINE}</p>
                ) : null}
              </>
            )
          ) : loading ? (
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
                        <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          {VERIFY_CHECK_LABEL}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
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

          {isDecisions ? null : (
          <>
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
          </>
          )}
        </aside>
      </div>

      {prefill ? (
        <AddDecisionDialog
          open
          onOpenChange={(next) => {
            if (!next) setPrefill(null);
          }}
          prefill={{
            situation: prefill.origin,
            call: prefill.call,
            why: prefill.what_it_decided,
          }}
        />
      ) : null}
    </div>
  );
}


/**
 * PASS 133 — the grace beat. When the run lands, the working scene keeps
 * playing for a moment so it never feels yanked away mid-thought. A failure
 * gets no grace, reduced motion has nothing to finish, and anyone who says
 * "enough" cuts it short at once.
 */
export function useResolveGrace(request: VerifyThreadRequest | null): {
  holding: boolean;
  cut: () => void;
} {
  const [holdingRun, setHoldingRun] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const seen = useRef<string | null>(null);
  /**
   * PASS 133.1 — skip disarms the grace for THIS pending request. A person
   * who pressed Skip said "enough": a resolve landing afterwards swaps
   * straight to the settled reader, no six-second freeze. The disarm is
   * per-request; a fresh open (request back to null) re-arms.
   */
  const disarmedFor = useRef<string | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const cut = useCallback(() => {
    clear();
    setHoldingRun(null);
    disarmedFor.current = request?.itemId ?? null;
  }, [clear, request]);

  const runId = request?.runId ?? null;
  const failed = typeof request?.error === "string" && request.error.length > 0;

  useEffect(() => {
    if (!request) {
      seen.current = null;
      disarmedFor.current = null;
      clear();
      setHoldingRun(null);
      return;
    }
    if (runId === null) {
      seen.current = null;
      return;
    }
    if (seen.current === runId) return;
    seen.current = runId;
    if (failed || prefersReducedMotion()) return;
    if (disarmedFor.current === request.itemId) return;
    setHoldingRun(runId);
    clear();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHoldingRun(null);
    }, RESOLVE_GRACE_MS);
  }, [clear, failed, request, runId]);

  useEffect(() => clear, [clear]);

  return { holding: holdingRun !== null && holdingRun === runId, cut };
}

export function VerifyThreadReader() {
  const request = useVerifyThread();
  const grace = useResolveGrace(request);
  if (!request) return null;
  // While the run is still going the reader is already open, over the same
  // transcript. When the run lands the settled reader takes its place.
  if (request.runId === null || grace.holding) {
    return (
      <PendingBody
        key={`pending:${request.itemId}`}
        request={request}
        onSkip={grace.cut}
      />
    );
  }
  return (
    <ReaderBody key={request.runId} request={request as VerifyThreadRequest & { runId: string }} />
  );
}
