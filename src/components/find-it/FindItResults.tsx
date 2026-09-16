import { useEffect, useMemo, useState, type AnimationEvent as ReactAnimationEvent, type CSSProperties } from "react";

import "./FindItResults.css";

import { GraphiteCheck } from "@/components/notebook/marks";
import { NotebookSpider } from "@/components/notebook/NotebookSpider";
import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
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
type ArcPlacement = Point & { arc: 0 | 1; height: number; width: number; growsLeft: boolean };
type TraceLine = { cycle: number; targetIndex: number; duration: number; delay: number; bendA: number; bendB: number };

const CANVAS_WIDTH = 1166;
const CANVAS_HEIGHT = 836;
const FOOTER_TOP = 787;
const ARC_TOP = 12;
const ARC_BOTTOM = FOOTER_TOP - 12;
const COLLAPSED_HEIGHT = 62;
const QUOTE_HEIGHT = 236;
const WHY_HEIGHT = 200;
const CARD_GAP = 14;

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
    ["--x" as string]: `${x / CANVAS_WIDTH * 100}%`,
    ["--y" as string]: `${y / CANVAS_HEIGHT * 100}%`,
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

function arcLayout(candidates: FindItCandidate[], selectedId: string | null): Map<string, ArcPlacement> {
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
      const bulge = (1 - middleDistance * middleDistance) * 140;
      const baseX = 660 + arc * 300;
      const width = entry.candidate.link.link_id === selectedId ? 420 : 250;
      const naturalX = Math.min(baseX + bulge, CANVAS_WIDTH - width / 2 - 12);
      const growsLeft = width === 420 && naturalX + width / 2 > CANVAS_WIDTH - 12;
      const x = growsLeft ? CANVAS_WIDTH - width / 2 - 12 : naturalX;
      placements.set(entry.candidate.link.link_id, { x, y, arc: arc as 0 | 1, height: entry.height, width, growsLeft });
      cursor += entry.height + CARD_GAP;
    }
  });
  return placements;
}

function placementStyle(placement: ArcPlacement, index: number): CanvasStyle {
  return {
    ["--x" as string]: `${placement.x / CANVAS_WIDTH * 100}%`,
    ["--y" as string]: `${placement.y / CANVAS_HEIGHT * 100}%`,
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
    <div data-testid={expanded ? "find-it-detail" : "find-it-node"} data-selected={selected ? "true" : "false"} data-strength={strength} className={`group/node relative rounded-[6px] border bg-card shadow-none ${selected ? "border-pencil shadow-[2px_2px_0_var(--nb-pencil)]" : "border-hairline"} ${status === "discarded" ? "opacity-50" : ""} ${className}`}>
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
  );
}

function TargetCard({ target, phase }: { target: WorkItemRow; phase: FindItPhase }) {
  const date = formatDate(effectiveWorkDate(target));
  const origin = target.source ? sourceLabel(target.source) : null;
  return (
    <div data-testid="find-it-target" className={`absolute z-20 w-[21.5%] min-w-[210px] max-w-[250px] -translate-x-1/2 -translate-y-1/2 transition-[left] duration-[480ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] ${phase === "reading" ? "left-[21%]" : "left-[39%]"} top-1/2`}>
      <WorkNote item={target} dense />
      <p className="mt-2 text-center font-hand text-[16px] text-green">{phase === "reading" ? `landed ${date}${origin ? ` from ${origin}` : ""}` : "line weight says how sure. no numbers."}</p>
    </div>
  );
}

function ReadingLines({ candidates }: { candidates: FindItCandidate[] }) {
  return (
    <svg data-testid="find-it-tracing-lines" aria-hidden viewBox="0 0 1166 836" preserveAspectRatio="none" className="find-it-trace-lines pointer-events-none absolute inset-0 z-0 h-full w-full">
      {candidates.slice(0, 4).map((candidate, index) => {
        const random = mulberry32(fnv1a(`trace-${candidate.link.link_id}`));
        const position = readingPosition(candidate.link.link_id, index);
        const x = Number.parseFloat(position["--x"] ?? "0") * 11.66;
        const y = Number.parseFloat(position["--y"] ?? "0") * 8.36;
        const wobbleA = (random() - 0.5) * 90;
        const wobbleB = (random() - 0.5) * 100;
        const style = {
          ["--trace-duration" as string]: `${1.6 + random() * 1.6}s`,
          ["--trace-delay" as string]: `${random() * 2.4}s`,
        } as CSSProperties;
        return <path key={candidate.link.link_id} data-testid="find-it-tracing-line" className="find-it-trace-line" style={style} pathLength="1" strokeWidth={1.4 + random() * 0.6} d={`M370 418 C${500 + wobbleA} ${350 + wobbleB}, ${x - 120 + wobbleB} ${y - wobbleA}, ${x - 82} ${y}`} />;
      })}
    </svg>
  );
}

function ArcArrow({ candidate, index, total, selected }: { candidate: FindItCandidate; index: number; total: number; selected: boolean }) {
  const position = arcPosition(candidate.link.link_id, index, total, selected);
  const x = Number.parseFloat(position["--x"] ?? "0") * 11.66;
  const y = Number.parseFloat(position["--y"] ?? "0") * 8.36;
  const random = mulberry32(fnv1a(`arrow-${candidate.link.link_id}`));
  const bendX = 625 + random() * 70;
  const bendY = 418 + (y - 418) * 0.42 + (random() - 0.5) * 16;
  const endX = x - (selected ? 210 : 125);
  const strength = strengthFor(index, total);
  const d = `M580 418 C${610 + random() * 18} 418 ${bendX} ${bendY}, ${bendX} ${bendY} S${endX - 34} ${y} ${endX} ${y}`;
  const head = `M${endX - 11} ${y - 6} L${endX} ${y} L${endX - 11} ${y + 6}`;
  return (
    <g data-testid="find-it-arrow" data-strength={strength} style={position}>
      <path className="find-it-arrow-line" pathLength="1" d={d} strokeWidth={strokeFor(strength)} strokeDasharray={strength === "light" ? "0.012 0.016" : undefined} />
      <path className="find-it-arrow-head" pathLength="1" d={head} strokeWidth={strokeFor(strength)} />
      <text x={(580 + endX) / 2} y={(418 + y) / 2 - 7} className={`fill-green font-hand text-[16px] transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}>{RELATION_CAPTION[candidate.link.relation] ?? "connected to it"}</text>
    </g>
  );
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
  const visible = useMemo(() => (phase === "kept" ? candidates.filter((candidate) => statusOf(candidate, reviewed) === "confirmed") : candidates), [candidates, phase, reviewed]);
  const ordered = useMemo(() => visible.slice(0, 16), [visible]);
  const selected = ordered.find((candidate) => candidate.link.link_id === selectedId) ?? ordered[0] ?? null;
  const keptCount = candidates.filter((candidate) => statusOf(candidate, reviewed) === "confirmed").length;
  const unmarkedCount = candidates.filter((candidate) => statusOf(candidate, reviewed) === "draft").length;

  useEffect(() => {
    if (!selectedId && ordered[0]) setSelectedId(ordered[0].link.link_id);
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
        <span className="flex min-w-0 items-center gap-1.5 rounded-[6px] border border-hairline bg-card px-2 py-1 text-[11.5px] text-foreground"><SourceMark item={target} size={12} /><span className="truncate">{target.title}</span></span>
        <span className="hidden shrink-0 rounded-[6px] border border-hairline px-2 py-1 text-[11.5px] text-muted-foreground sm:inline">{scope === "engagement" ? "This engagement" : "Everything I have"}</span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onChooseTarget}>Choose something else</Button>
      </header>

      <div className="min-h-0 p-1 md:p-3">
        <div className="find-it-stage relative hidden h-full max-h-full w-full overflow-hidden rounded-[8px] border border-hairline bg-background md:block">
          <TargetCard target={target} phase={phase} />
          {phase === "reading" ? (
            <>
              {!reduceMotion ? <ReadingLines candidates={candidates.slice(0, 14)} /> : null}
              <NotebookSpider size={160} reading={!reduceMotion} className="absolute left-[5%] top-[19%] z-10" />
              <div data-testid="find-it-reading-nodes" className="absolute inset-0">
                {candidates.slice(0, 14).map((candidate, index) => <div key={candidate.link.link_id} className="find-it-reading-node absolute z-10 w-[160px]" style={readingPosition(candidate.link.link_id, index)}><FindItNode candidate={candidate} /></div>)}
              </div>
              <p className="absolute bottom-3 left-4 font-hand text-[16px] text-green">reading {considered} conversations</p>
            </>
          ) : (
            <div data-testid="find-it-arc" className="absolute inset-0">
              <svg aria-hidden viewBox="0 0 1166 836" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                {ordered.map((candidate, index) => <ArcArrow key={candidate.link.link_id} candidate={candidate} index={index} total={ordered.length} selected={phase === "settled" && selected?.link.link_id === candidate.link.link_id} />)}
              </svg>
              {ordered.map((candidate, index) => {
                const isSelected = phase === "settled" && selected?.link.link_id === candidate.link.link_id;
                const itemId = candidate.item?.id;
                return <div key={candidate.link.link_id} className={`find-it-arc-node absolute z-10 ${isSelected ? "w-[36%] max-w-[420px]" : "w-[21.5%] max-w-[250px]"}`} style={arcPosition(candidate.link.link_id, index, ordered.length, isSelected)}><FindItNode candidate={candidate} selected={isSelected} expanded={isSelected} status={phase === "kept" ? "confirmed" : statusOf(candidate, reviewed)} strength={strengthFor(index, ordered.length)} {...(phase === "settled" ? { onSelect: () => setSelectedId(candidate.link.link_id) } : {})} onKeep={() => act("confirmed")} onReject={() => act("discarded")} onOpen={itemId ? () => onOpenThread(itemId, candidate.link.quote ? { turnNo: candidate.link.quote.turn_no, text: candidate.link.quote.text } : undefined) : null} /></div>;
              })}
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

        <div className="h-full min-h-0 overflow-y-auto py-3 md:hidden">
          {phase === "reading" ? <div className="mb-3 flex items-center gap-2 font-hand text-[16px] text-green"><NotebookSpider size={24} reading={!reduceMotion} />reading {considered} conversations</div> : null}
          {(phase === "reading" ? candidates.slice(0, 14) : ordered).map((candidate, index) => <Button key={candidate.link.link_id} type="button" variant="ghost" className={`h-12 w-full justify-start rounded-none border-b border-hairline px-1 ${statusOf(candidate, reviewed) === "discarded" ? "opacity-50" : ""}`} disabled={phase !== "settled"} onClick={() => { setSelectedId(candidate.link.link_id); setMobileDetailOpen(true); }}><span className="micro-label mr-2">CONVERSATION</span><span className="min-w-0 flex-1 truncate text-left text-[13px]">{candidateLine(candidate.item)}</span>{phase !== "reading" ? <span className="sr-only">{strengthFor(index, ordered.length)}</span> : null}</Button>)}
        </div>
      </div>

      {mobileDetailOpen && selected && phase === "settled" ? <div className="fixed inset-0 z-50 flex items-end bg-foreground/20 md:hidden" role="dialog" aria-modal="true" aria-label="Source detail"><Button type="button" variant="ghost" className="absolute inset-0 h-full w-full rounded-none" aria-label="Close source detail" onClick={() => setMobileDetailOpen(false)} /><div className="relative z-10 max-h-[78dvh] w-full overflow-y-auto rounded-t-[8px] border border-hairline bg-background p-5 shadow-[var(--shadow-modal)]"><FindItNode candidate={selected} selected expanded status={statusOf(selected, reviewed)} onKeep={() => act("confirmed")} onReject={() => act("discarded")} onOpen={selected.item ? () => onOpenThread(selected.item?.id ?? "", selected.link.quote ? { turnNo: selected.link.quote.turn_no, text: selected.link.quote.text } : undefined) : null} /></div></div> : null}
    </section>
  );
}
