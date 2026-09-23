import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { EvidenceCircle, MarginFlag, VerifyInk } from "@/components/notebook/marks";
import { mergeRanges, type CharRange } from "@/lib/canvas-lab-annotations-shared";
import { supabase } from "@/integrations/supabase/client";
import { splitByQuote, turnAnchorId, type ThreadMark } from "@/lib/verify-thread-shared";
import { vendorLabel } from "@/lib/conversation-shared";
import type { WorkItemRow } from "@/lib/work-types";

type Turn = {
  id: string;
  turn_no: number;
  role: string;
  content: string;
  content_hash?: string | null;
  ts: string | null;
  model?: string | null;
  meta?: unknown;
};

export type ThreadFocus = { turnNo?: number; text?: string };

/** Slice 2a: a person's own highlights, already resolved against the turn. */
export type ThreadHighlight = {
  id: string;
  turnNo: number;
  charStart: number;
  charEnd: number;
  stale: boolean;
};

/**
 * Every live range on one turn, drawn as one quiet marker per merged span.
 * Overlapping ranges merge so a doubled highlight never reads as darker ink.
 * A commented passage carries an underline instead of a wash, so review reads
 * differently from a person's own private highlight even where they overlap.
 */
function HighlightedContent({
  content,
  ranges,
  commentRanges = [],
}: {
  content: string;
  ranges: readonly CharRange[];
  commentRanges?: readonly CharRange[];
}) {
  const marks = mergeRanges(ranges).filter((range) => range.charStart < content.length);
  const notes = mergeRanges(commentRanges).filter((range) => range.charStart < content.length);
  if (marks.length === 0 && notes.length === 0) return <>{content}</>;

  const cuts = new Set<number>([0, content.length]);
  for (const range of [...marks, ...notes]) {
    cuts.add(Math.max(0, Math.min(range.charStart, content.length)));
    cuts.add(Math.max(0, Math.min(range.charEnd, content.length)));
  }
  const edges = [...cuts].sort((a, b) => a - b);
  const parts: React.ReactNode[] = [];
  for (let index = 0; index < edges.length - 1; index += 1) {
    const start = edges[index] ?? 0;
    const end = edges[index + 1] ?? 0;
    if (end <= start) continue;
    const text = content.slice(start, end);
    const inMark = marks.some((range) => range.charStart <= start && range.charEnd >= end);
    const inNote = notes.some((range) => range.charStart <= start && range.charEnd >= end);
    if (!inMark && !inNote) {
      parts.push(<span key={start}>{text}</span>);
      continue;
    }
    parts.push(
      <mark
        key={start}
        data-testid={inMark ? "turn-highlight" : "turn-comment-mark"}
        data-commented={inNote ? "true" : undefined}
        className={`rounded-[2px] text-foreground ${
          inMark
            ? "border-b-2 border-solid border-[var(--nb-lasso-green)] bg-[var(--nb-lasso-green-wash)]"
            : "bg-transparent"
        } ${
          inNote ? "underline decoration-[var(--nb-lasso-green)] decoration-2 underline-offset-2" : ""
        }`}
      >
        {text}
      </mark>,
    );
  }
  return <>{parts}</>;
}

function normaliseWithMap(value: string): { text: string; starts: number[]; ends: number[] } {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let inSpace = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";
    if (/\s/.test(character)) {
      if (text.length > 0 && !inSpace) {
        text += " ";
        starts.push(index);
        ends.push(index + 1);
      }
      inSpace = true;
    } else {
      text += character.toLocaleLowerCase();
      starts.push(index);
      ends.push(index + 1);
      inSpace = false;
    }
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    starts.pop();
    ends.pop();
  }
  return { text, starts, ends };
}

export function focusedTextRange(content: string, query: string | undefined): [number, number] | null {
  const needle = normaliseWithMap(query?.trim() ?? "").text;
  if (!needle) return null;
  const haystack = normaliseWithMap(content);
  const at = haystack.text.indexOf(needle);
  if (at < 0) return null;
  const start = haystack.starts[at];
  const end = haystack.ends[at + needle.length - 1];
  return start === undefined || end === undefined ? null : [start, end];
}

function FocusedContent({ content, range }: { content: string; range: [number, number] | null }) {
  if (!range) return <>{content}</>;
  return <>{content.slice(0, range[0])}<span data-testid="focused-evidence-text" className="relative inline-block"><EvidenceCircle />{content.slice(range[0], range[1])}</span>{content.slice(range[1])}</>;
}

const EMPTY_SETTLED: ReadonlySet<string> = new Set<string>();

function turnTime(ts: string | null): string | null {
  if (!ts) return null;
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

/** A turn a later push rewrote. The record says so, quietly. */
function revisedLabel(turn: Turn): string | null {
  const meta =
    turn.meta && typeof turn.meta === "object" && !Array.isArray(turn.meta)
      ? (turn.meta as { revised_at?: unknown })
      : null;
  if (typeof meta?.revised_at !== "string") return null;
  const date = new Date(meta.revised_at);
  if (Number.isNaN(date.getTime())) return null;
  return `Revised by a re-push · ${date.toLocaleDateString()}`;
}

/**
 * P1 item 2. A span the pushing client could no longer reproduce word for
 * word. The record says exactly which positions it stands for.
 */
export function summarisedSpan(turn: { meta?: unknown }): { from: number; to: number } | null {
  const meta =
    turn.meta && typeof turn.meta === "object" && !Array.isArray(turn.meta)
      ? (turn.meta as { fidelity?: unknown; covers_from?: unknown; covers_to?: unknown })
      : null;
  if (meta?.fidelity !== "summary") return null;
  const from = meta.covers_from;
  const to = meta.covers_to;
  if (typeof from !== "number" || typeof to !== "number") return null;
  return { from, to };
}

export function summarisedLabel(span: { from: number; to: number }): string {
  return `Summarised by the AI client. Messages ${span.from} to ${span.to} were not available word for word.`;
}

/**
 * The model's own words, with any verification ink settled on the claim span.
 * A mark is only ever drawn on a model turn: human turns render untouched.
 */
function TurnContent({
  turn,
  marks,
  activeMarkId,
  settledIds,
  reducedMotion,
}: {
  turn: Turn;
  marks: readonly ThreadMark[];
  activeMarkId: string | null;
  settledIds: ReadonlySet<string>;
  reducedMotion: boolean;
}) {
  const isHuman = turn.role === "user";
  const mark = isHuman ? undefined : marks.find((m) => m.turnNo === turn.turn_no);
  const split = mark ? splitByQuote(turn.content, mark.quote) : null;
  if (!mark || !split) return <>{turn.content}</>;
  return (
    <>
      {split.before}
      <VerifyInk
        verdict={mark.verdict}
        seed={mark.id}
        active={activeMarkId === mark.id || settledIds.has(mark.id)}
        bold={mark.bold !== false}
        reducedMotion={reducedMotion}
      >
        {split.match}
      </VerifyInk>
      {split.after}
    </>
  );
}

/** The conversation itself, shared by the peek panel and the standalone viewer. */
export function ThreadBody({
  item,
  enabled = true,
  marks = [],
  activeMarkId = null,
  settledIds = EMPTY_SETTLED,
  onMarkActivate,
  reducedMotion = false,
  focus,
  highlights = [],
  commentMarks = [],
}: {
  item: WorkItemRow;
  enabled?: boolean;
  /** Verification ink to settle on model turns. Empty everywhere else. */
  marks?: readonly ThreadMark[];
  activeMarkId?: string | null;
  /** Marks whose ink has settled during the reader's intro pass. */
  settledIds?: ReadonlySet<string>;
  /** Tapping a margin flag activates that finding on the rail. */
  onMarkActivate?: ((markId: string) => void) | undefined;
  reducedMotion?: boolean;
  focus?: ThreadFocus | undefined;
  /** The reader's own highlights. A stale one is listed, never drawn. */
  highlights?: readonly ThreadHighlight[];
  /** Passages carrying a live comment. A stale one is listed, never drawn. */
  commentMarks?: readonly ThreadHighlight[];
}) {
  const { data: turns, error } = useQuery({
    queryKey: ["turns", item.id],
    enabled,
    queryFn: async (): Promise<Turn[]> => {
      const { data, error: turnsError } = await supabase
        .from("turns")
        .select("id, turn_no, role, content, content_hash, ts, model, meta")
        .eq("work_item_id", item.id)
        .order("turn_no", { ascending: true });
      if (turnsError) throw turnsError;
      return (data ?? []) as Turn[];
    },
  });
  const turnRefs = useRef(new Map<number, HTMLDivElement>());
  const focusedTurn = useMemo(() => {
    if (!focus || !turns?.length) return null;
    if (focus.turnNo !== undefined) {
      const exact = turns.find((turn) => turn.turn_no === focus.turnNo);
      if (exact) return exact;
    }
    if (focus.text) return turns.find((turn) => focusedTextRange(turn.content, focus.text) !== null) ?? null;
    return null;
  }, [focus, turns]);

  useEffect(() => {
    if (!enabled || !focusedTurn) return;
    turnRefs.current.get(focusedTurn.turn_no)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [enabled, focusedTurn, reducedMotion]);

  const meta = item.source_meta ?? null;
  const model = meta?.model ?? null;
  const expectedTotal =
    typeof item.meta?.expected_total === "number" ? item.meta.expected_total : null;
  const turnCount = turns?.length ?? 0;
  const metaBits = [
    meta?.skills_used && meta.skills_used.length > 0
      ? `Skills: ${meta.skills_used.join(", ")}`
      : null,
    meta?.thinking_level && meta.thinking_level !== "none"
      ? `Thinking: ${meta.thinking_level}`
      : null,
    meta?.research_mode && meta.research_mode !== "none"
      ? `Research: ${meta.research_mode.replace("_", " ")}`
      : null,
    meta?.notes ?? null,
  ].filter((bit): bit is string => Boolean(bit));

  return (
    <div className="space-y-4">
      {item.source_vendor || model ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {vendorLabel(item.source_vendor ?? meta?.vendor)}
          {model ? ` · ${model}` : ""}
        </p>
      ) : null}
      {metaBits.length > 0 ? (
        <p className="text-xs text-muted-foreground">{metaBits.join(" · ")}</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

      {expectedTotal && turns && turnCount < expectedTotal ? (
        <p className="text-xs text-muted-foreground">
          {turnCount} of {expectedTotal} messages captured so far.
        </p>
      ) : null}

      {item.content_fidelity === "summary" ? (
        <p className="rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground">
          Copilot exports contain summaries, not full replies. For work that matters, paste the
          conversation for full fidelity.
        </p>
      ) : null}

      <div className="space-y-5">
        {(turns ?? []).map((turn) => {
          const focused = focusedTurn?.id === turn.id;
          const focusedRange = focused ? focusedTextRange(turn.content, focus?.text) : null;
          const liveRanges: CharRange[] = highlights
            .filter((highlight) => highlight.turnNo === turn.turn_no && !highlight.stale)
            .map((highlight) => ({ charStart: highlight.charStart, charEnd: highlight.charEnd }));
          const noteRanges: CharRange[] = commentMarks
            .filter((mark) => mark.turnNo === turn.turn_no && !mark.stale)
            .map((mark) => ({ charStart: mark.charStart, charEnd: mark.charEnd }));
          const marked = !focusedRange && (liveRanges.length > 0 || noteRanges.length > 0);
          const span = summarisedSpan(turn);
          const summarisedNote = span ? (
            <p data-testid="turn-summarised" className="mb-1 text-[11px] text-muted-foreground">
              {summarisedLabel(span)}
            </p>
          ) : null;
          const summarisedTone = span ? " text-muted-foreground" : "";
          return (
          <div key={turn.id} ref={(node) => { if (node) turnRefs.current.set(turn.turn_no, node); else turnRefs.current.delete(turn.turn_no); }} data-turn-no={turn.turn_no}>
          {turn.role === "user" ? (
            <div className="flex flex-col items-end">
              <div className="micro-label mb-1">
                Turn {turn.turn_no} · {turn.role}
                {turnTime(turn.ts) ? ` · ${turnTime(turn.ts)}` : ""}
              </div>
              {summarisedNote}
              <div
                data-turn-content={turn.turn_no}
                className={`relative max-w-[90%] whitespace-pre-wrap rounded-[var(--radius)] bg-grey-2 px-4 py-3 font-mono text-xs leading-relaxed ${span ? "text-muted-foreground" : "text-foreground"} ${focused && !focusedRange ? "is-evidence-focus" : ""}`}
              >
                {focused && !focusedRange ? <EvidenceCircle /> : null}
                {marked ? (
                  <HighlightedContent content={turn.content} ranges={liveRanges} commentRanges={noteRanges} />
                ) : (
                  <FocusedContent content={turn.content} range={focusedRange} />
                )}
              </div>
              {revisedLabel(turn) ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{revisedLabel(turn)}</p>
              ) : null}
            </div>
          ) : (
            (() => {
              const flag = marks.find((m) => m.turnNo === turn.turn_no);
              const lit = flag?.lit === true;
              return (
                <div id={turnAnchorId(turn.turn_no)}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="grid w-[16px] shrink-0 place-items-center">
                      {flag ? (
                        <MarginFlag
                          seed={flag.id}
                          verdict={flag.verdict}
                          stroke={flag.stroke}
                          dashed={flag.dashed}
                          label={`Go to the finding on turn ${turn.turn_no}`}
                          {...(onMarkActivate
                            ? { onActivate: () => onMarkActivate(flag.id) }
                            : {})}
                        />
                      ) : null}
                    </span>
                    <span className="micro-label">
                      Turn {turn.turn_no} · {turn.role}
                      {turn.model ? ` · ${turn.model}` : model ? ` · ${model}` : ""}
                      {turnTime(turn.ts) ? ` · ${turnTime(turn.ts)}` : ""}
                    </span>
                  </div>
                  {summarisedNote}
                  <div
                    data-turn-content={turn.turn_no}
                    data-lit={lit ? "true" : undefined}
                    data-testid={lit ? `turn-lit-${turn.turn_no}` : undefined}
                    className={`relative max-w-[90%] whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card px-4 py-3 font-mono text-xs leading-relaxed${summarisedTone || " text-foreground"} shadow-card${
                      lit ? " nb-turn-lit border-l-[3px]" : ""
                    } ${focused && !focusedRange ? "is-evidence-focus" : ""}`}
                    {...(lit
                      ? {
                          style: {
                            ["--span-color" as string]: flag?.stroke ?? "var(--nb-ink-yellow)",
                            ["--span-wash" as string]:
                              flag?.wash ?? "var(--status-unsourced-wash)",
                          } as React.CSSProperties,
                        }
                      : {})}
                  >
                    {focused && !focusedRange ? <EvidenceCircle /> : null}
                    {focusedRange ? (
                      <FocusedContent content={turn.content} range={focusedRange} />
                    ) : marked && !flag ? (
                      <HighlightedContent content={turn.content} ranges={liveRanges} commentRanges={noteRanges} />
                    ) : (
                      <TurnContent
                        turn={turn}
                        marks={marks}
                        activeMarkId={activeMarkId}
                        settledIds={settledIds}
                        reducedMotion={reducedMotion}
                      />
                    )}
                  </div>
                  {revisedLabel(turn) ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">{revisedLabel(turn)}</p>
                  ) : null}
                </div>
              );
            })()
          )}
          {focused ? <p className="mt-2 font-hand text-[16px] text-green">this is the turn it came from</p> : null}
          </div>
          );
        })}
        {turns && turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No turns stored for this item.</p>
        ) : null}
      </div>
    </div>
  );
}
