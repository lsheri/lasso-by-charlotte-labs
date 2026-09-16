import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { GraphiteCheck } from "@/components/notebook/marks";
import { NotebookSpider } from "@/components/notebook/NotebookSpider";
import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { SourceMark } from "@/components/work/SourceMark";
import { WorkNote } from "@/components/work/WorkNote";
import type { FoundSource, FindScope } from "@/lib/find-it.functions";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

export type FindItCandidate = { link: FoundSource; item: WorkItemRow | null };
export type FindItPhase = "reading" | "settled" | "kept";

const RELATION_ORDER = ["informed", "cited", "produced", "revised"] as const;
const RELATION_LABEL: Record<string, string> = {
  informed: "INFORMED",
  cited: "CITED",
  produced: "PRODUCED",
  revised: "REVISED",
};

function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function positionFor(id: string): CSSProperties {
  const random = mulberry32(fnv1a(id));
  return {
    ["--x" as string]: `${24 + random() * 50}%`,
    ["--y" as string]: `${8 + random() * 72}%`,
    ["--r" as string]: `${-1.2 + random() * 2.4}deg`,
    ["--delay" as string]: `${Math.floor(random() * 800)}ms`,
  };
}

function statusOf(candidate: FindItCandidate, reviewed: Record<string, "confirmed" | "discarded">): string {
  return reviewed[candidate.link.link_id] ?? candidate.link.status;
}

function RelationStub({ rank, total }: { rank: number; total: number }) {
  const heavy = rank < total / 3;
  const dotted = rank >= (total * 2) / 3;
  return (
    <svg aria-hidden viewBox="0 0 34 12" className="absolute -left-7 top-1/2 h-3 w-8 -translate-y-1/2 overflow-visible" fill="none">
      <path d="M1 6C10 5.4 20 6.8 33 5.8" stroke="var(--nb-pencil)" strokeWidth={heavy ? 2.4 : 1.4} strokeLinecap="round" strokeDasharray={dotted ? "2 4" : undefined} />
    </svg>
  );
}

function RejectedStrike() {
  return (
    <svg aria-hidden viewBox="0 0 120 12" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-1/2 h-3 w-full -translate-y-1/2" fill="none" stroke="var(--nb-graphite)" strokeWidth={1.4} strokeLinecap="round">
      <path d="M4 7C24 5.4 44 8.2 64 6.6c18-1.4 36 .6 52-1.2" />
    </svg>
  );
}

export function FindItNode({ candidate, selected = false, status = "draft", rank = 0, total = 1, settled = false, onSelect, className = "" }: {
  candidate: FindItCandidate;
  selected?: boolean;
  status?: string;
  rank?: number;
  total?: number;
  settled?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const item = candidate.item;
  return (
    <Button type="button" variant="ghost" onClick={onSelect} data-testid="find-it-node" data-selected={selected ? "true" : "false"} className={`relative h-[clamp(44px,7dvh,72px)] w-full justify-start whitespace-normal rounded-[6px] border px-2 py-1.5 text-left shadow-none ${selected ? "border-pencil bg-card shadow-[2px_2px_0_var(--nb-pencil)]" : "border-hairline bg-card hover:border-pencil hover:bg-card"} ${status === "discarded" ? "opacity-50" : ""} ${className}`}>
      {settled ? <RelationStub rank={rank} total={total} /> : null}
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        {item ? <SourceMark item={item} size={14} disc /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-foreground">{item?.title ?? "A conversation you can no longer read."}</span>
          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{item ? formatDate(effectiveWorkDate(item)) : "Unavailable"}</span>
        </span>
        {status === "confirmed" ? <GraphiteCheck seed={candidate.link.link_id} className="text-green" /> : null}
        {status === "discarded" ? <RejectedStrike /> : null}
      </span>
    </Button>
  );
}

function CandidateDetail({ candidate, onKeep, onReject, onOpen }: { candidate: FindItCandidate; onKeep: () => void; onReject: () => void; onOpen: (() => void) | null }) {
  const { item, link } = candidate;
  const [expanded, setExpanded] = useState(false);
  const rationale = link.rationale ?? (link.quote ? "this sentence is in both" : "the work is connected");
  return (
    <div data-testid="find-it-detail" className="flex h-full min-h-0 flex-col">
      <div className="flex min-w-0 items-start gap-2">
        {item ? <SourceMark item={item} size={18} disc /> : null}
        <div className="min-w-0 flex-1">
          {onOpen ? <Button type="button" variant="ghost" onClick={onOpen} className="h-auto max-w-full justify-start whitespace-normal p-0 text-left text-[13px] font-normal hover:bg-transparent"><span className="line-clamp-2">{item?.title}</span></Button> : <p className="line-clamp-2 text-[13px] text-foreground">{item?.title ?? "A conversation you can no longer read."}</p>}
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{item ? formatDate(effectiveWorkDate(item)) : "Unavailable"}</p>
        </div>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <ToneCard tone="claim" className="gap-2 p-4">
          {link.quote ? <p className="font-mono text-[11.5px] leading-5">{link.quote.text}</p> : <p className="font-hand text-[16px] text-soft">no exact sentence shared</p>}
        </ToneCard>
        <p className={`mt-3 font-hand text-[16px] leading-5 text-green ${expanded ? "" : "line-clamp-6"}`}>why: {rationale}</p>
        {rationale.length > 180 ? <Button type="button" variant="ghost" size="sm" className="mt-1 h-auto p-0 font-hand text-[16px] text-green" onClick={() => setExpanded((value) => !value)}>{expanded ? "less" : "more"}</Button> : null}
      </div>
      <div className="mt-4 grid shrink-0 gap-2">
        <Button type="button" onClick={onKeep}>Keep as a source</Button>
        <Button type="button" variant="outline" onClick={onReject}>Not this one</Button>
      </div>
    </div>
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
  onOpenThread: (workItemId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const attached = useMemo(
    () => phase === "kept" ? candidates.filter((candidate) => statusOf(candidate, reviewed) === "confirmed") : candidates,
    [candidates, phase, reviewed],
  );
  const groups = useMemo(() => RELATION_ORDER.map((relation) => ({ relation, members: attached.filter((candidate) => candidate.link.relation === relation) })).filter((group) => group.members.length > 0), [attached]);
  const ordered = useMemo(() => groups.flatMap((group) => group.members), [groups]);
  const selected = ordered.find((candidate) => candidate.link.link_id === selectedId) ?? ordered[0] ?? null;
  const keptCount = candidates.filter((candidate) => statusOf(candidate, reviewed) === "confirmed").length;

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
      if (event.key === "Escape") {
        event.preventDefault();
        onChooseTarget();
        return;
      }
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
    <section data-testid="find-it-canvas" data-phase={phase} className="find-it-canvas grid h-dvh min-h-0 snap-start grid-rows-[48px_minmax(0,1fr)_56px] overflow-hidden bg-background" aria-label="Find it canvas">
      <header className="flex min-w-0 items-center gap-2 border-b border-hairline px-1 md:px-3">
        <h2 className="shrink-0 font-serif text-[26px] leading-none text-foreground">Find it</h2>
        <span className="flex min-w-0 items-center gap-1.5 rounded-[6px] border border-hairline bg-card px-2 py-1 text-[11.5px] text-foreground"><SourceMark item={target} size={12} /><span className="truncate">{target.title}</span></span>
        <span className="hidden shrink-0 rounded-[6px] border border-hairline px-2 py-1 text-[11.5px] text-muted-foreground sm:inline">{scope === "engagement" ? "This engagement" : "Everything I have"}</span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onChooseTarget}>Choose something else</Button>
      </header>

      <div className="relative min-h-0 overflow-hidden">
        <div className="hidden h-full min-h-0 grid-cols-[180px_minmax(0,1fr)_340px] gap-5 py-4 md:grid">
          <div className="self-center" data-testid="find-it-target"><WorkNote item={target} dense /></div>
          {phase === "reading" && !reduceMotion ? (
            <div className="relative min-h-0 overflow-hidden" data-testid="find-it-reading-nodes">
              {candidates.slice(0, 12).map((candidate) => <div key={candidate.link.link_id} className="find-it-scattered-node absolute w-[clamp(150px,17vw,220px)]" style={positionFor(candidate.link.link_id)}><FindItNode candidate={candidate} /></div>)}
              <div className="absolute bottom-2 left-3 flex items-center gap-2 font-hand text-[16px] text-green"><NotebookSpider size={30} reading />looks again</div>
            </div>
          ) : (
            <div className="grid min-h-0 grid-flow-col auto-cols-fr gap-5 overflow-hidden" data-testid="find-it-settled-nodes">
              {groups.map((group) => <section key={group.relation} className="flex min-h-0 flex-col" aria-label={`${RELATION_LABEL[group.relation]} ${group.members.length}`}><h3 className="micro-label mb-3 shrink-0">{RELATION_LABEL[group.relation]} · {group.members.length}</h3><div className="min-h-0 space-y-2 overflow-y-auto pl-7 pr-1 [scrollbar-width:thin]">{group.members.map((candidate) => { const rank = ordered.findIndex((entry) => entry.link.link_id === candidate.link.link_id); return <FindItNode key={candidate.item?.id ?? candidate.link.link_id} candidate={candidate} selected={phase === "settled" && selected?.link.link_id === candidate.link.link_id} status={phase === "kept" ? "confirmed" : statusOf(candidate, reviewed)} rank={rank} total={ordered.length} settled {...(phase === "settled" ? { onSelect: () => setSelectedId(candidate.link.link_id) } : {})} />; })}</div></section>)}
            </div>
          )}
          <aside className={`min-h-0 border-l border-hairline pl-5 transition-[transform,opacity] duration-[480ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] ${phase === "settled" ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0"}`}>
            {selected && phase === "settled" ? <CandidateDetail candidate={selected} onKeep={() => act("confirmed")} onReject={() => act("discarded")} onOpen={selected.item ? () => onOpenThread(selected.item?.id ?? "") : null} /> : null}
          </aside>
        </div>

        <div className="h-full min-h-0 overflow-y-auto py-3 md:hidden">
          {phase === "reading" ? <div className="mb-3 flex items-center gap-2 font-hand text-[16px] text-green"><NotebookSpider size={24} reading={!reduceMotion} />reading {considered} conversations</div> : null}
          {(phase === "reading" ? candidates.slice(0, 12) : ordered).map((candidate) => <Button key={candidate.link.link_id} type="button" variant="ghost" className={`h-12 w-full justify-start rounded-none border-b border-hairline px-1 ${statusOf(candidate, reviewed) === "discarded" ? "opacity-50" : ""}`} disabled={phase !== "settled"} onClick={() => { setSelectedId(candidate.link.link_id); setMobileDetailOpen(true); }}>{candidate.item ? <SourceMark item={candidate.item} size={14} /> : null}<span className="min-w-0 flex-1 truncate text-left text-[13px]">{candidate.item?.title ?? "Unavailable conversation"}</span>{phase !== "reading" ? <span className="micro-label shrink-0">{RELATION_LABEL[candidate.link.relation]}</span> : null}</Button>)}
        </div>
      </div>

      <footer className="flex min-w-0 items-center gap-2 border-t border-hairline bg-background px-1 md:px-3">
        {phase === "reading" ? <p className="min-w-0 flex-1 truncate font-hand text-[16px] text-green">reading {considered} conversations</p> : <p className="min-w-0 flex-1 truncate font-hand text-[16px] text-green">Kept {keptCount} of {candidates.length} · goes on the record of this deck</p>}
        {phase === "settled" ? <><Button type="button" variant="outline" size="sm" onClick={() => void onKeepAll()}>Keep all</Button><Button type="button" size="sm" onClick={() => void onDone()}>Done</Button></> : null}
        {phase !== "reading" ? <Button type="button" variant="ghost" size="sm" onClick={onReturnToForm}>Look for something else</Button> : null}
      </footer>

      {mobileDetailOpen && selected && phase === "settled" ? <div className="fixed inset-0 z-50 flex items-end bg-foreground/20 md:hidden" role="dialog" aria-modal="true" aria-label="Source detail"><Button type="button" variant="ghost" className="absolute inset-0 h-full w-full rounded-none" aria-label="Close source detail" onClick={() => setMobileDetailOpen(false)} /><div className="relative z-10 max-h-[78dvh] w-full overflow-y-auto rounded-t-[8px] border border-hairline bg-background p-5 shadow-[var(--shadow-modal)]"><CandidateDetail candidate={selected} onKeep={() => act("confirmed")} onReject={() => act("discarded")} onOpen={selected.item ? () => onOpenThread(selected.item?.id ?? "") : null} /></div></div> : null}
    </section>
  );
}
