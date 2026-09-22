import { useEffect, useMemo, useRef, useState, type AnimationEvent as ReactAnimationEvent, type CSSProperties } from "react";

import "./FindItResults.css";

import { GraphiteCheck } from "@/components/notebook/marks";
import { NotebookSpider } from "@/components/notebook/NotebookSpider";
import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { DimmedDisabled } from "@/components/common/DimmedDisabled";
import { SourceMark } from "@/components/work/SourceMark";
import { WorkNote } from "@/components/work/WorkNote";
import type { FoundSource, FindScope } from "@/lib/find-it.functions";
import { fnv1a, mulberry32 } from "@/lib/journey-path";
import { effectiveWorkDate, formatDate, sourceLabel, type WorkItemRow } from "@/lib/work-types";
import type { ThreadFocus } from "@/components/peek/ThreadBody";

export type FindItCandidate = { link: FoundSource; item: WorkItemRow | null };
export type FindItPhase = "reading" | "settled" | "kept";
type Strength = "heavy" | "normal" | "light";
type CanvasStyle = CSSProperties & Record<`--${string}`, string>;
type Point = { x: number; y: number };
export type ArcPlacement = Point & { arc: 0 | 1; height: number; width: number; growsLeft: boolean };
type TraceLine = { cycle: number; targetIndex: number; duration: number; delay: number; bendA: number; bendB: number };

const CANVAS_WIDTH = 1166;
const CANVAS_HEIGHT = 836;
const FOOTER_TOP = 787;
const ARC_TOP = 12;
const ARC_BOTTOM = FOOTER_TOP - 12;
const COLLAPSED_HEIGHT = 62;
const QUOTE_HEIGHT = 230;
const WHY_HEIGHT = 200;
const CARD_GAP = 14;
const STAGE_INSET = 12;
const STAGE_RIGHT = CANVAS_WIDTH - STAGE_INSET;
export const SETTLED_TARGET_RECT = { left: 330, right: 580, top: 308, bottom: 528 };

const RELATION_CAPTION: Record<string, string> = {
  produced: "where it was written",
  informed: "shaped the thinking",
  revised: "changed it after v1",
  cited: "quoted in it",
};

function statusOf(candidate: FindItCandidate, reviewed: Record<string, "confirmed" | "discarded">): string {
  return reviewed[candidate.link.link_id] ?? candidate.link.status;
}

function candidateLine(item: WorkItemRow | null): string {
  if (!item) return "A conversation you can no longer read.";
  const source = item.source ? sourceLabel(item.source) : "unknown source";
  return `${item.title}, ${source}, ${formatDate(effectiveWorkDate(item))}`;
}

function shuffledSlots(candidates: FindItCandidate[]): number[] {
  const slots = Array.from({ length: 16 }, (_, index) => index);
  const random = mulberry32(fnv1a(candidates.map(({ link }) => link.link_id).join("|")));
  for (let index = slots.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const held = slots[index];
    slots[index] = slots[swapWith] ?? index;
    slots[swapWith] = held ?? swapWith;
  }
  return slots;
}

function readingPosition(id: string, slot: number): CanvasStyle {
  const random = mulberry32(fnv1a(`slot-${id}`));
  const column = slot % 4;
  const row = Math.floor(slot / 4);
  const x = 500 + column * 185 + (random() * 20 - 10);
  const y = 92 + row * 208 + (random() * 20 - 10);
  return {
    ["--x" as string]: `${x}px`,
    ["--y" as string]: `${y}px`,
    ["--drift-x" as string]: `${4 + random() * 4}px`,
    ["--drift-y" as string]: `${4 + random() * 4}px`,
    ["--drift-duration" as string]: `${6 + random() * 3}s`,
    ["--drift-delay" as string]: `${-random() * 4}s`,
    ["--node-height" as string]: "56px",
  };
}

function strengthFor(candidate: FindItCandidate): Strength {
  if (candidate.link.quote?.text.trim()) return "heavy";
  const rationale = candidate.link.rationale ?? "";
  if (/\d/.test(rationale) || /\b(?:deck|memo|document|presentation|spreadsheet|brief|proposal|report|transcript|file)(?:\s+[\w.-]+)?\b/i.test(rationale)) return "normal";
  return "light";
}

function orderByEvidence(candidates: FindItCandidate[]): FindItCandidate[] {
  const rank: Record<Strength, number> = { heavy: 0, normal: 1, light: 2 };
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => rank[strengthFor(a.candidate)] - rank[strengthFor(b.candidate)] || a.index - b.index)
    .map(({ candidate }) => candidate);
}

function cardHeight(candidate: FindItCandidate, selectedId: string | null): number {
  if (candidate.link.link_id !== selectedId) return COLLAPSED_HEIGHT;
  return candidate.link.quote ? QUOTE_HEIGHT : WHY_HEIGHT;
}

function columnTotal(entries: { height: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.height, 0) + Math.max(0, entries.length - 1) * CARD_GAP;
}

function rectOf(placement: ArcPlacement) {
  return {
    left: placement.x - placement.width / 2,
    right: placement.x + placement.width / 2,
    top: placement.y - placement.height / 2,
    bottom: placement.y + placement.height / 2,
  };
}

function rectsIntersect(a: ReturnType<typeof rectOf>, b: ReturnType<typeof rectOf>): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function resolveCollisions(placements: Map<string, ArcPlacement>, candidates: FindItCandidate[], selectedId: string | null) {
  const rank: Record<Strength, number> = { heavy: 2, normal: 1, light: 0 };
  const ids = candidates.map(({ link }) => link.link_id).filter((id) => placements.has(id));

  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (const id of ids) {
      const placement = placements.get(id);
      if (!placement || !rectsIntersect(rectOf(placement), SETTLED_TARGET_RECT)) continue;
      const minX = STAGE_INSET + placement.width / 2;
      const maxX = STAGE_RIGHT - placement.width / 2;
      const direction = placement.x < (SETTLED_TARGET_RECT.left + SETTLED_TARGET_RECT.right) / 2 ? -1 : 1;
      while (rectsIntersect(rectOf(placement), SETTLED_TARGET_RECT)) {
        const nextX = Math.min(maxX, Math.max(minX, placement.x + direction * 8));
        if (nextX === placement.x) break;
        placement.x = nextX;
        changed = true;
      }
    }
    for (let firstIndex = 0; firstIndex < ids.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < ids.length; secondIndex += 1) {
        const firstId = ids[firstIndex];
        const secondId = ids[secondIndex];
        if (!firstId || !secondId) continue;
        const first = placements.get(firstId);
        const second = placements.get(secondId);
        if (!first || !second || !rectsIntersect(rectOf(first), rectOf(second))) continue;

        const firstCandidate = candidates.find(({ link }) => link.link_id === firstId);
        const secondCandidate = candidates.find(({ link }) => link.link_id === secondId);
        if (!firstCandidate || !secondCandidate) continue;
        const firstPriority = firstId === selectedId ? 10 : rank[strengthFor(firstCandidate)];
        const secondPriority = secondId === selectedId ? 10 : rank[strengthFor(secondCandidate)];
        const moveFirst = firstPriority < secondPriority;
        const movingId = moveFirst ? firstId : secondId;
        const fixed = moveFirst ? second : first;
        const moving = moveFirst ? first : second;
        const direction = moving.x < fixed.x ? -1 : 1;
        const minX = STAGE_INSET + moving.width / 2;
        const maxX = STAGE_RIGHT - moving.width / 2;

        while (rectsIntersect(rectOf(moving), rectOf(fixed))) {
          const nextX = Math.min(maxX, Math.max(minX, moving.x + direction * 8));
          if (nextX === moving.x) break;
          moving.x = nextX;
          changed = true;
        }

        if (rectsIntersect(rectOf(moving), rectOf(fixed))) {
          const selected = firstId === selectedId ? first : secondId === selectedId ? second : null;
          if (selected) {
            while (rectsIntersect(rectOf(moving), rectOf(fixed))) {
              const nextX = Math.max(STAGE_INSET + selected.width / 2, selected.x - 8);
              const nextRect = rectOf({ ...selected, x: nextX });
              if (nextX === selected.x || rectsIntersect(nextRect, SETTLED_TARGET_RECT)) break;
              selected.x = nextX;
              changed = true;
            }
            while (rectsIntersect(rectOf(moving), rectOf(fixed))) {
              const nextY = Math.max(ARC_TOP + selected.height / 2, selected.y - 8);
              const nextRect = rectOf({ ...selected, y: nextY });
              if (nextY === selected.y || rectsIntersect(nextRect, SETTLED_TARGET_RECT)) break;
              selected.y = nextY;
              changed = true;
            }
          }
        }

        if (rectsIntersect(rectOf(moving), rectOf(fixed))) {
          const laterId = ids[Math.max(firstIndex, secondIndex)];
          const later = laterId ? placements.get(laterId) : null;
          if (!later) continue;
          const sameColumnAfter = ids
            .flatMap((id) => {
              const placement = placements.get(id);
              return placement && placement.arc === later.arc && placement.y >= later.y ? [{ id, placement }] : [];
            });
          const lowestBottom = Math.max(...sameColumnAfter.map(({ placement }) => rectOf(placement).bottom));
          const shift = Math.min(8, Math.max(0, ARC_BOTTOM - lowestBottom));
          if (shift > 0) {
            sameColumnAfter.forEach(({ placement }) => { placement.y += shift; });
            changed = true;
          }
        }
        placements.set(movingId, moving);
      }
    }
    if (!changed) break;
  }
}

export function arcLayout(candidates: FindItCandidate[], selectedId: string | null): Map<string, ArcPlacement> {
  const entries = candidates.map((candidate) => ({ candidate, height: cardHeight(candidate, selectedId) }));
  const available = ARC_BOTTOM - ARC_TOP;
  const columns = columnTotal(entries) > available
    ? [entries.filter((_, index) => index % 2 === 0), entries.filter((_, index) => index % 2 === 1)]
    : [entries, []];
  const placements = new Map<string, ArcPlacement>();

  columns.forEach((column, arc) => {
    if (!column.length) return;
    const total = columnTotal(column);
    const interleaveOffset = arc === 1 ? (COLLAPSED_HEIGHT + CARD_GAP) / 2 : 0;
    const unclampedStart = ARC_TOP + (available - total) / 2 + interleaveOffset;
    const start = Math.min(Math.max(ARC_TOP, unclampedStart), ARC_BOTTOM - total);
    let cursor = start;
    for (const entry of column) {
      const y = cursor + entry.height / 2;
      const middleDistance = Math.min(1, Math.abs(y - CANVAS_HEIGHT / 2) / (available / 2));
      const bulgeFactor = 1 - middleDistance * middleDistance;
      const width = entry.candidate.link.link_id === selectedId ? 400 : 240;
      const laneCenter = arc === 0 ? 690 + bulgeFactor * 80 : 1015 + bulgeFactor * 25;
      const overflow = Math.max(0, laneCenter + width / 2 - STAGE_RIGHT);
      const growsLeft = overflow > 0;
      const desiredX = laneCenter - overflow;
      const x = Math.min(Math.max(STAGE_INSET + width / 2, desiredX), STAGE_RIGHT - width / 2);
      placements.set(entry.candidate.link.link_id, { x, y, arc: arc as 0 | 1, height: entry.height, width, growsLeft });
      cursor += entry.height + CARD_GAP;
    }
  });
  resolveCollisions(placements, candidates, selectedId);
  return placements;
}

function placementStyle(placement: ArcPlacement, index: number): CanvasStyle {
  return {
    ["--x" as string]: `${placement.x}px`,
    ["--y" as string]: `${placement.y}px`,
    ["--node-height" as string]: `${placement.height}px`,
    ["--node-width" as string]: `${placement.width}px`,
    ["--arrow-delay" as string]: `${index * 60}ms`,
  };
}

function strokeFor(strength: Strength): number {
  if (strength === "heavy") return 2.6;
  if (strength === "light") return 1.2;
  return 1.8;
}

function RejectedStrike() {
  return (
    <svg aria-hidden viewBox="0 0 120 12" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-1/2 h-3 w-full -translate-y-1/2" fill="none" stroke="var(--nb-graphite)" strokeWidth={1.4} strokeLinecap="round">
      <path d="M4 7C24 5.4 44 8.2 64 6.6c18-1.4 36 .6 52-1.2" />
    </svg>
  );
}

export function FindItNode({ candidate, selected = false, status = "draft", expanded = false, strength = "normal", onSelect, onKeep, onReject, onOpen, className = "" }: {
  candidate: FindItCandidate;
  selected?: boolean;
  status?: string;
  expanded?: boolean;
  strength?: Strength;
  onSelect?: () => void;
  onKeep?: () => void;
  onReject?: () => void;
  onOpen?: (() => void) | null;
  className?: string;
}) {
  const { item, link } = candidate;
  const rationale = link.rationale ?? (link.quote ? "this sentence is in both" : "the work is connected");
  return (
    <DimmedDisabled dimmed={status === "discarded"} disabled={false}>
    <div data-testid={expanded ? "find-it-detail" : "find-it-node"} data-selected={selected ? "true" : "false"} data-strength={strength} className={`nb-card-surface group/node relative rounded-[6px] bg-card shadow-none ${selected ? "shadow-[2px_2px_0_var(--nb-pencil)]" : ""} ${className}`}>
      <Button type="button" variant="ghost" onClick={onSelect} className={`w-full justify-start whitespace-normal rounded-[6px] px-3 text-left hover:bg-card ${expanded ? "h-auto min-h-[62px] py-3" : "h-[56px] py-2"}`}>
        <span className="relative min-w-0 flex-1">
          <span className="micro-label block">CONVERSATION</span>
          <span className="mt-0.5 block truncate text-[13px] font-normal text-foreground">{candidateLine(item)}</span>
          {status === "discarded" ? <RejectedStrike /> : null}
        </span>
      </Button>
      {status === "confirmed" ? <GraphiteCheck seed={link.link_id} className="absolute right-2 top-2 text-green" /> : null}
      {expanded ? (
        <div className="px-3 pb-3">
          {link.quote ? (
            <>
              <ToneCard tone="claim" className="gap-2 p-3"><p className="font-mono text-[13px] leading-5">{link.quote.text}</p></ToneCard>
              <p className="mt-2 font-hand text-[16px] leading-5 text-green">why: {rationale}</p>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-5 text-foreground">{rationale}</p>
              <p className="mt-2 font-hand text-[16px] leading-5 text-soft">no exact sentence in both, this is the model's reading of the evidence</p>
            </>
          )}
          <div className="mt-3 flex items-center gap-4">
            <Button type="button" size="sm" onClick={onKeep}>Keep as a source</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onReject} className="h-auto p-0 font-hand text-[16px] underline decoration-pencil underline-offset-4 hover:bg-transparent">Not this one</Button>
            {onOpen ? <Button type="button" variant="ghost" size="sm" onClick={onOpen} className="ml-auto h-auto p-0 font-hand text-[16px] text-green hover:bg-transparent">open</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
    </DimmedDisabled>
  );
}

function TargetCard({ target, phase }: { target: WorkItemRow; phase: FindItPhase }) {
  const date = formatDate(effectiveWorkDate(target));
  const origin = target.source ? sourceLabel(target.source) : null;
  return (
    <div data-testid="find-it-target" className={`find-it-target absolute z-20 w-[250px] -translate-x-1/2 -translate-y-1/2 transition-[left] duration-[480ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] ${phase === "reading" ? "find-it-target-reading" : "find-it-target-settled"}`}>
      <WorkNote item={target} dense />
      <p className="mt-2 text-center font-hand text-[16px] text-green">{phase === "reading" ? `landed ${date}${origin ? ` from ${origin}` : ""}` : "line weight says how sure. no numbers."}</p>
    </div>
  );
}

function makeTraceLine(lane: number, cycle: number, count: number): TraceLine {
  const random = mulberry32(fnv1a(`trace-lane-${lane}-cycle-${cycle}`));
  const cycleStart = count > 0 ? Math.floor(mulberry32(fnv1a(`trace-cycle-${cycle}`))() * count) : 0;
  const priorStart = count > 0 ? Math.floor(mulberry32(fnv1a(`trace-cycle-${Math.max(0, cycle - 1)}`))() * count) : 0;
  let targetIndex = count > 0 ? (cycleStart + lane) % count : 0;
  const prior = count > 0 ? (priorStart + lane) % count : 0;
  if (count > 1 && targetIndex === prior) targetIndex = (targetIndex + 1) % count;
  return {
    cycle,
    targetIndex,
    duration: 1.6 + random() * 1.6,
    delay: cycle === 0 ? random() * 2.4 : 0,
    bendA: (random() - 0.5) * 90,
    bendB: (random() - 0.5) * 100,
  };
}

function ReadingLines({ candidates, slots }: { candidates: FindItCandidate[]; slots: number[] }) {
  const extraRandom = mulberry32(fnv1a(candidates.map(({ link }) => link.link_id).join("|")));
  const lineCount = 3 + (extraRandom() < 0.3 ? 1 : 0);
  const [lines, setLines] = useState<TraceLine[]>(() => Array.from({ length: lineCount }, (_, lane) => makeTraceLine(lane, 0, Math.max(1, candidates.length))));

  useEffect(() => {
    setLines(Array.from({ length: lineCount }, (_, lane) => makeTraceLine(lane, 0, Math.max(1, candidates.length))));
  }, [candidates, lineCount]);

  function renew(lane: number, event: ReactAnimationEvent<SVGPathElement>) {
    if (event.animationName !== "find-it-trace") return;
    setLines((current) => current.map((line, index) => index === lane ? makeTraceLine(lane, line.cycle + 1, Math.max(1, candidates.length)) : line));
  }

  return (
    <svg data-testid="find-it-tracing-lines" aria-hidden viewBox="0 0 1166 836" preserveAspectRatio="none" className="find-it-trace-lines pointer-events-none absolute inset-0 z-0 h-full w-full">
      {lines.map((line, lane) => {
        const candidate = candidates[line.targetIndex];
        if (!candidate) return null;
        const position = readingPosition(candidate.link.link_id, slots[line.targetIndex] ?? line.targetIndex);
         const x = Number.parseFloat(position["--x"] ?? "0");
         const y = Number.parseFloat(position["--y"] ?? "0");
        const style = {
          ["--trace-duration" as string]: `${line.duration}s`,
          ["--trace-delay" as string]: `${line.delay}s`,
        } as CSSProperties;
        return <path key={lane} data-testid="find-it-tracing-line" data-target={candidate.link.link_id} className="find-it-trace-line" style={style} pathLength="1" strokeWidth={1.4 + lane * 0.18} onAnimationIteration={(event) => renew(lane, event)} d={`M370 418 C${500 + line.bendA} ${350 + line.bendB}, ${x - 120 + line.bendB} ${y - line.bendA}, ${x - 82} ${y}`} />;
      })}
    </svg>
  );
}

function arrowGeometry(candidate: FindItCandidate, placement: ArcPlacement) {
  const x = placement.x;
  const y = placement.y;
  const random = mulberry32(fnv1a(`arrow-${candidate.link.link_id}`));
  const bendX = 625 + random() * 70;
  const bendY = 418 + (y - 418) * 0.42 + (random() - 0.5) * 16;
  const endX = x - placement.width / 2 - 4;
  const strength = strengthFor(candidate);
  const d = `M580 418 C${610 + random() * 18} 418 ${bendX} ${bendY}, ${bendX} ${bendY} S${endX - 34} ${y} ${endX} ${y}`;
  const head = `M${endX - 11} ${y - 6} L${endX} ${y} L${endX - 11} ${y + 6}`;
  const arrowLength = Math.hypot(endX - 580, y - 418);
  return { d, head, endX, y, strength, arrowLength };
}

function ArcArrow({ candidate, index, placement }: { candidate: FindItCandidate; index: number; placement: ArcPlacement }) {
  const { d, head, strength } = arrowGeometry(candidate, placement);
  const style = placementStyle(placement, index);
  return (
    <g data-testid="find-it-arrow" data-strength={strength} style={style}>
      <path className="find-it-arrow-line" pathLength="1" d={d} strokeWidth={strokeFor(strength)} strokeDasharray={strength === "light" ? "0.012 0.016" : undefined} />
      <path className="find-it-arrow-head" pathLength="1" d={head} strokeWidth={strokeFor(strength)} />
    </g>
  );
}

function ArcCaption({ candidate, index, placement, placements }: { candidate: FindItCandidate; index: number; placement: ArcPlacement; placements: Map<string, ArcPlacement> }) {
  const { endX, y, arrowLength } = arrowGeometry(candidate, placement);
  if (arrowLength < 120) return null;
  const caption = RELATION_CAPTION[candidate.link.relation] ?? "connected to it";
  const captionWidth = Math.max(86, caption.length * 7.4);
  const candidatesForT = [0, 0.08, -0.08, 0.16, -0.16].map((offset) => 0.40 + (index % 4) * 0.12 + offset);
  const position = candidatesForT.map((t) => {
    const x = 580 + (endX - 580) * t;
    const baseline = 418 + (y - 418) * t - 8;
    const rect = { left: x - captionWidth / 2 - 5, right: x + captionWidth / 2 + 5, top: baseline - 15, bottom: baseline + 6 };
    return { x, baseline, clear: Array.from(placements.values()).every((card) => !rectsIntersect(rect, rectOf(card))) };
  }).find(({ clear }) => clear);
  if (!position) return null;
  return <g data-testid="find-it-arrow-caption" className="find-it-arrow-caption"><rect x={position.x - captionWidth / 2 - 5} y={position.baseline - 15} width={captionWidth + 10} height={21} rx={4} /><text x={position.x} y={position.baseline} textAnchor="middle" className="fill-green font-hand text-[16px]">{caption}</text></g>;
}

export function FindItResults({ phase, target, scope, candidates, reviewed, considered, reduceMotion, onChooseTarget, onReturnToForm, onReview, onKeepAll, onDone, onOpenThread }: {
  phase: FindItPhase;
  target: WorkItemRow;
  scope: FindScope;
  candidates: FindItCandidate[];
  reviewed: Record<string, "confirmed" | "discarded">;
  considered: number;
  reduceMotion: boolean;
  onChooseTarget: () => void;
  onReturnToForm: () => void;
  onReview: (linkId: string, action: "confirmed" | "discarded") => void | Promise<void>;
  onKeepAll: () => void | Promise<void>;
  onDone: () => void | Promise<void>;
  onOpenThread: (workItemId: string, focus?: ThreadFocus) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const stageShellRef = useRef<HTMLDivElement>(null);
  const [stageMetrics, setStageMetrics] = useState({ scale: 1, left: 0 });
  const visible = useMemo(() => (phase === "kept" ? candidates.filter((candidate) => statusOf(candidate, reviewed) === "confirmed") : candidates), [candidates, phase, reviewed]);
  const ordered = useMemo(() => orderByEvidence(visible.slice(0, 16)), [visible]);
  const selected = ordered.find((candidate) => candidate.link.link_id === selectedId) ?? ordered.find((candidate) => strengthFor(candidate) !== "light") ?? ordered[0] ?? null;
  const selectedForLayout = phase === "settled" ? selected?.link.link_id ?? null : null;
  const placements = useMemo(() => arcLayout(ordered, selectedForLayout), [ordered, selectedForLayout]);
  const readingSlots = useMemo(() => shuffledSlots(candidates.slice(0, 14)), [candidates]);
  const keptCount = candidates.filter((candidate) => statusOf(candidate, reviewed) === "confirmed").length;
  const unmarkedCount = candidates.filter((candidate) => statusOf(candidate, reviewed) === "draft").length;

  useEffect(() => {
    const shell = stageShellRef.current;
    const available = shell?.parentElement;
    if (!shell || !available || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
      const scale = Math.min(entry.contentRect.width / CANVAS_WIDTH, entry.contentRect.height / CANVAS_HEIGHT);
      setStageMetrics({ scale, left: Math.max(0, (entry.contentRect.width - CANVAS_WIDTH * scale) / 2) });
    });
    observer.observe(available);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const selectedStillExists = ordered.some((candidate) => candidate.link.link_id === selectedId);
    if ((!selectedId || !selectedStillExists) && ordered[0]) {
      const preferred = ordered.find((candidate) => strengthFor(candidate) !== "light") ?? ordered[0];
      setSelectedId(preferred.link.link_id);
    }
  }, [ordered, selectedId]);

  function move(delta: number) {
    if (!ordered.length) return;
    const at = Math.max(0, ordered.findIndex((candidate) => candidate.link.link_id === selected?.link.link_id));
    const next = ordered[Math.min(ordered.length - 1, Math.max(0, at + delta))];
    if (next) setSelectedId(next.link.link_id);
  }

  function act(action: "confirmed" | "discarded") {
    if (!selected || phase !== "settled") return;
    void onReview(selected.link.link_id, action);
    const at = ordered.findIndex((candidate) => candidate.link.link_id === selected.link.link_id);
    const next = [...ordered.slice(at + 1), ...ordered.slice(0, at)].find((candidate) => statusOf(candidate, reviewed) === "draft" && candidate.link.link_id !== selected.link.link_id);
    if (next) setSelectedId(next.link.link_id);
    else setMobileDetailOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (phase !== "settled") return;
      if (event.key === "Escape") { event.preventDefault(); onChooseTarget(); return; }
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element?.closest("button, input, textarea, [role='dialog']")) return;
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") { event.preventDefault(); move(1); }
      else if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") { event.preventDefault(); move(-1); }
      else if (event.key === "Enter") { event.preventDefault(); act("confirmed"); }
      else if (event.key === "Backspace" || event.key.toLowerCase() === "x") { event.preventDefault(); act("discarded"); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <section data-testid="find-it-canvas" data-phase={phase} className="find-it-canvas grid h-dvh min-h-0 snap-start grid-rows-[48px_minmax(0,1fr)] overflow-hidden bg-background" aria-label="Find it canvas">
      <header className="flex min-w-0 items-center gap-2 px-1 md:px-3">
        <h2 className="shrink-0 font-serif text-[26px] leading-none text-foreground">Find it</h2>
        <span className="flex min-w-0 items-center gap-1.5 rounded-[6px] border border-hairline bg-card px-2 py-1 nb-type-small text-foreground"><SourceMark item={target} size={12} /><span className="truncate">{target.title}</span></span>
        <span className="hidden shrink-0 rounded-[6px] border border-hairline px-2 py-1 nb-type-small text-muted-foreground sm:inline">{scope === "engagement" ? "This engagement" : "Everything I have"}</span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onChooseTarget}>Choose something else</Button>
      </header>

      <div className="min-h-0 p-1 md:p-3">
        <div ref={stageShellRef} className="find-it-stage-shell relative hidden w-full overflow-hidden md:block" style={{ ["--stage-scale" as string]: String(stageMetrics.scale), ["--stage-left" as string]: `${stageMetrics.left}px` } as CanvasStyle}>
         <div className="find-it-stage absolute left-0 top-0 overflow-hidden rounded-[8px] border border-hairline bg-background">
          <TargetCard target={target} phase={phase} />
          {phase === "reading" ? (
            <>
              {!reduceMotion ? <ReadingLines candidates={candidates.slice(0, 14)} slots={readingSlots} /> : null}
               <NotebookSpider size={160} reading={!reduceMotion} className="find-it-spider absolute z-10" />
              <div data-testid="find-it-reading-nodes" className="absolute inset-0">
                {candidates.slice(0, 14).map((candidate, index) => <div key={candidate.link.link_id} data-slot={readingSlots[index]} className="find-it-reading-node absolute z-10 w-[160px]" style={readingPosition(candidate.link.link_id, readingSlots[index] ?? index)}><FindItNode candidate={candidate} /></div>)}
              </div>
               <p className="find-it-reading-caption absolute font-hand text-[16px] text-green">reading {considered} conversations</p>
            </>
          ) : (
            <div data-testid="find-it-arc" className="absolute inset-0">
               <svg aria-hidden viewBox="0 0 1166 836" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
                {ordered.map((candidate, index) => {
                  const placement = placements.get(candidate.link.link_id);
                  return placement ? <ArcArrow key={candidate.link.link_id} candidate={candidate} index={index} placement={placement} /> : null;
                })}
              </svg>
              {ordered.map((candidate, index) => {
                const isSelected = phase === "settled" && selected?.link.link_id === candidate.link.link_id;
                const itemId = candidate.item?.id;
                 const placement = placements.get(candidate.link.link_id);
                 if (!placement) return null;
                 return <div key={candidate.link.link_id} data-testid="find-it-arc-node" data-arc={placement.arc} data-evidence={strengthFor(candidate)} data-grows={placement.growsLeft ? "left" : "right"} className="find-it-arc-node absolute z-10" style={placementStyle(placement, index)}><FindItNode candidate={candidate} selected={isSelected} expanded={isSelected} status={phase === "kept" ? "confirmed" : statusOf(candidate, reviewed)} strength={strengthFor(candidate)} {...(phase === "settled" ? { onSelect: () => setSelectedId(candidate.link.link_id) } : {})} onKeep={() => act("confirmed")} onReject={() => act("discarded")} onOpen={itemId ? () => onOpenThread(itemId, candidate.link.quote ? { turnNo: candidate.link.quote.turn_no, text: candidate.link.quote.text } : undefined) : null} /></div>;
              })}
               <svg aria-hidden viewBox="0 0 1166 836" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
                 {ordered.map((candidate, index) => {
                   const placement = placements.get(candidate.link.link_id);
                   return placement ? <ArcCaption key={candidate.link.link_id} candidate={candidate} index={index} placement={placement} placements={placements} /> : null;
                 })}
               </svg>
            </div>
          )}

          {phase !== "reading" ? (
            <footer className="absolute inset-x-0 bottom-0 z-30 flex min-w-0 items-center gap-3 border-t border-hairline bg-background/95 px-4 py-2">
              {phase === "settled" ? <Button type="button" size="sm" disabled={unmarkedCount === 0} onClick={() => void onKeepAll()}>Keep {unmarkedCount} as sources</Button> : <p className="font-hand text-[16px] text-green">Kept {keptCount} sources</p>}
              <p className="font-hand text-[16px] text-green">goes on the record of this deck</p>
              {phase === "settled" && unmarkedCount === 0 ? <Button type="button" size="sm" onClick={() => void onDone()}>Done</Button> : null}
              {phase === "kept" ? <Button type="button" variant="ghost" size="sm" onClick={onReturnToForm}>Look for something else</Button> : null}
              <Button type="button" variant="ghost" size="sm" className="ml-auto font-hand text-[16px]" onClick={phase === "kept" ? onReturnToForm : onChooseTarget}>close</Button>
            </footer>
          ) : null}
         </div>
        </div>

        <div className="h-full min-h-0 overflow-y-auto py-3 md:hidden">
          {phase === "reading" ? <div className="mb-3 flex items-center gap-2 font-hand text-[16px] text-green"><NotebookSpider size={24} reading={!reduceMotion} />reading {considered} conversations</div> : null}
          {(phase === "reading" ? candidates.slice(0, 14) : ordered).map((candidate) => <Button key={candidate.link.link_id} type="button" variant="ghost" className={`h-12 w-full justify-start rounded-none border-b border-hairline px-1 ${statusOf(candidate, reviewed) === "discarded" ? "opacity-50" : ""}`} disabled={phase !== "settled"} onClick={() => { setSelectedId(candidate.link.link_id); setMobileDetailOpen(true); }}><span className="micro-label mr-2">CONVERSATION</span><span className="min-w-0 flex-1 truncate text-left text-[13px]">{candidateLine(candidate.item)}</span>{phase !== "reading" ? <span className="sr-only">{strengthFor(candidate)}</span> : null}</Button>)}
        </div>
      </div>

      {mobileDetailOpen && selected && phase === "settled" ? <div className="fixed inset-0 z-50 flex items-end bg-foreground/20 md:hidden" role="dialog" aria-modal="true" aria-label="Source detail"><Button type="button" variant="ghost" className="absolute inset-0 h-full w-full rounded-none" aria-label="Close source detail" onClick={() => setMobileDetailOpen(false)} /><div className="relative z-10 max-h-[78dvh] w-full overflow-y-auto rounded-t-[8px] border border-hairline bg-background p-5 shadow-[var(--shadow-modal)]"><FindItNode candidate={selected} selected expanded status={statusOf(selected, reviewed)} onKeep={() => act("confirmed")} onReject={() => act("discarded")} onOpen={selected.item ? () => onOpenThread(selected.item?.id ?? "", selected.link.quote ? { turnNo: selected.link.quote.turn_no, text: selected.link.quote.text } : undefined) : null} /></div></div> : null}
    </section>
  );
}
