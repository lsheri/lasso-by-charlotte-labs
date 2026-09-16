import { useEffect, useMemo, useState } from "react";

import { GraphiteCheck } from "@/components/notebook/marks";
import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { SourceMark } from "@/components/work/SourceMark";
import { WorkNote } from "@/components/work/WorkNote";
import type { FoundSource, FindScope } from "@/lib/find-it.functions";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

export type FindItCandidate = { link: FoundSource; item: WorkItemRow | null };

const RELATION_ORDER = ["informed", "cited", "produced", "revised"] as const;

const RELATION_LABEL: Record<string, string> = {
  informed: "INFORMED",
  cited: "CITED",
  produced: "PRODUCED",
  revised: "REVISED",
};

function statusOf(
  candidate: FindItCandidate,
  reviewed: Record<string, "confirmed" | "discarded">,
): string {
  return reviewed[candidate.link.link_id] ?? candidate.link.status;
}

function RelationStub({ rank, total }: { rank: number; total: number }) {
  const heavy = rank < total / 3;
  const dotted = rank >= (total * 2) / 3;
  return (
    <svg
      aria-hidden
      viewBox="0 0 34 12"
      className="absolute -left-7 top-1/2 h-3 w-8 -translate-y-1/2 overflow-visible"
      fill="none"
    >
      <path
        d="M1 6C10 5.4 20 6.8 33 5.8"
        stroke="var(--nb-pencil)"
        strokeWidth={heavy ? 2.4 : 1.4}
        strokeLinecap="round"
        strokeDasharray={dotted ? "2 4" : undefined}
      />
    </svg>
  );
}

function RejectedStrike() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-1/2 h-3 w-full -translate-y-1/2"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.4}
      strokeLinecap="round"
    >
      <path d="M4 7C24 5.4 44 8.2 64 6.6c18-1.4 36 .6 52-1.2" />
    </svg>
  );
}

function CandidateNode({
  candidate,
  selected,
  status,
  rank,
  total,
  onSelect,
}: {
  candidate: FindItCandidate;
  selected: boolean;
  status: string;
  rank: number;
  total: number;
  onSelect: () => void;
}) {
  const item = candidate.item;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      data-testid="find-it-node"
      data-selected={selected ? "true" : "false"}
      className={`relative h-[clamp(44px,7dvh,72px)] w-full justify-start whitespace-normal rounded-[6px] border px-2 py-1.5 text-left shadow-none ${
        selected
          ? "border-pencil bg-card shadow-[2px_2px_0_var(--nb-pencil)]"
          : "border-hairline bg-card hover:border-pencil hover:bg-card"
      } ${status === "discarded" ? "opacity-50" : ""}`}
    >
      <RelationStub rank={rank} total={total} />
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        {item ? <SourceMark item={item} size={14} disc /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-foreground">
            {item?.title ?? "A conversation you can no longer read."}
          </span>
          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {item ? formatDate(effectiveWorkDate(item)) : "Unavailable"}
          </span>
        </span>
        {status === "confirmed" ? (
          <GraphiteCheck seed={candidate.link.link_id} className="text-green" />
        ) : null}
        {status === "discarded" ? <RejectedStrike /> : null}
      </span>
    </Button>
  );
}

function CandidateDetail({
  candidate,
  onKeep,
  onReject,
  onOpen,
}: {
  candidate: FindItCandidate;
  onKeep: () => void;
  onReject: () => void;
  onOpen: (() => void) | null;
}) {
  const { item, link } = candidate;
  return (
    <div data-testid="find-it-detail" className="flex h-full min-h-0 flex-col">
      <div className="flex min-w-0 items-start gap-2">
        {item ? <SourceMark item={item} size={18} disc /> : null}
        <div className="min-w-0 flex-1">
          {onOpen ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onOpen}
              className="h-auto max-w-full justify-start whitespace-normal p-0 text-left text-[13px] font-normal hover:bg-transparent"
            >
              <span className="line-clamp-2">{item?.title}</span>
            </Button>
          ) : (
            <p className="line-clamp-2 text-[13px] text-foreground">
              {item?.title ?? "A conversation you can no longer read."}
            </p>
          )}
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {item ? formatDate(effectiveWorkDate(item)) : "Unavailable"}
          </p>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {link.quote ? (
          <ToneCard tone="claim" className="gap-2 p-4">
            <p className="font-mono text-[11.5px] leading-5">{link.quote.text}</p>
          </ToneCard>
        ) : (
          <ToneCard tone="claim" className="gap-2 p-4">
            <p className="font-hand text-[16px] text-soft">no exact sentence shared</p>
          </ToneCard>
        )}
        <p className="mt-3 font-hand text-[16px] leading-5 text-green">
          why: {link.rationale ?? (link.quote ? "this sentence is in both" : "the work is connected")}
        </p>
      </div>

      <div className="mt-4 grid shrink-0 gap-2">
        <Button type="button" onClick={onKeep}>Keep as a source</Button>
        <Button type="button" variant="outline" onClick={onReject}>Not this one</Button>
      </div>
    </div>
  );
}

export function FindItResults({
  target,
  scope,
  candidates,
  reviewed,
  onChooseAgain,
  onReview,
  onKeepAll,
  onDone,
  onOpenThread,
}: {
  target: WorkItemRow;
  scope: FindScope;
  candidates: FindItCandidate[];
  reviewed: Record<string, "confirmed" | "discarded">;
  onChooseAgain: () => void;
  onReview: (linkId: string, action: "confirmed" | "discarded") => void | Promise<void>;
  onKeepAll: () => void | Promise<void>;
  onDone: () => void | Promise<void>;
  onOpenThread: (workItemId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const groups = useMemo(
    () =>
      RELATION_ORDER.map((relation) => ({
        relation,
        members: candidates.filter((candidate) => candidate.link.relation === relation),
      })).filter((group) => group.members.length > 0),
    [candidates],
  );
  const ordered = useMemo(() => groups.flatMap((group) => group.members), [groups]);
  const selected = ordered.find((candidate) => candidate.link.link_id === selectedId) ?? ordered[0] ?? null;
  const keptCount = candidates.filter((candidate) => statusOf(candidate, reviewed) === "confirmed").length;

  useEffect(() => {
    if (!selectedId && ordered[0]) setSelectedId(ordered[0].link.link_id);
  }, [ordered, selectedId]);

  function move(delta: number) {
    if (ordered.length === 0) return;
    const at = Math.max(0, ordered.findIndex((candidate) => candidate.link.link_id === selected?.link.link_id));
    const next = ordered[Math.min(ordered.length - 1, Math.max(0, at + delta))];
    if (next) setSelectedId(next.link.link_id);
  }

  function advanceAfter(linkId: string) {
    const at = ordered.findIndex((candidate) => candidate.link.link_id === linkId);
    const next = [...ordered.slice(at + 1), ...ordered.slice(0, at)].find(
      (candidate) => statusOf(candidate, reviewed) === "draft" && candidate.link.link_id !== linkId,
    );
    if (next) setSelectedId(next.link.link_id);
    else setMobileDetailOpen(false);
  }

  function act(action: "confirmed" | "discarded") {
    if (!selected) return;
    void onReview(selected.link.link_id, action);
    advanceAfter(selected.link.link_id);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onChooseAgain();
        return;
      }
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element?.closest("button, input, textarea, [role='dialog']")) return;
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        act("confirmed");
      } else if (event.key === "Backspace" || event.key.toLowerCase() === "x") {
        event.preventDefault();
        act("discarded");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <section className="-my-6 flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden md:-my-12 md:h-dvh" aria-label="Find it results">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline px-1 md:px-3">
        <h1 className="shrink-0 font-serif text-[26px] leading-none text-foreground">Find it</h1>
        <span className="flex min-w-0 items-center gap-1.5 rounded-[6px] border border-hairline bg-card px-2 py-1 text-[11.5px] text-foreground">
          <SourceMark item={target} size={12} />
          <span className="truncate">{target.title}</span>
        </span>
        <span className="hidden shrink-0 rounded-[6px] border border-hairline px-2 py-1 text-[11.5px] text-muted-foreground sm:inline">
          {scope === "engagement" ? "This engagement" : "Everything I have"}
        </span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onChooseAgain}>
          Choose something else
        </Button>
      </header>

      <div className="min-h-0 flex-1 md:grid md:grid-cols-[180px_minmax(0,1fr)_340px] md:gap-5 md:py-4">
        <div className="hidden self-center md:block" data-testid="find-it-target">
          <WorkNote item={target} dense />
        </div>

        <div className="hidden min-h-0 grid-flow-col auto-cols-fr gap-5 overflow-hidden md:grid">
          {groups.map((group) => (
            <section key={group.relation} className="flex min-h-0 flex-col" aria-label={`${RELATION_LABEL[group.relation]} ${group.members.length}`}>
              <h2 className="micro-label mb-3 shrink-0">
                {RELATION_LABEL[group.relation]} · {group.members.length}
              </h2>
              <div className="min-h-0 space-y-2 overflow-y-auto pl-7 pr-1 [scrollbar-width:thin]">
                {group.members.map((candidate) => {
                  const rank = ordered.findIndex((entry) => entry.link.link_id === candidate.link.link_id);
                  return (
                    <CandidateNode
                      key={candidate.link.link_id}
                      candidate={candidate}
                      selected={selected?.link.link_id === candidate.link.link_id}
                      status={statusOf(candidate, reviewed)}
                      rank={rank}
                      total={ordered.length}
                      onSelect={() => setSelectedId(candidate.link.link_id)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="hidden min-h-0 border-l border-hairline pl-5 md:block">
          {selected ? (
            <CandidateDetail
              candidate={selected}
              onKeep={() => act("confirmed")}
              onReject={() => act("discarded")}
              onOpen={selected.item ? () => onOpenThread(selected.item?.id ?? "") : null}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing of yours reads as a source for this one.</p>
          )}
        </aside>

        <div className="min-h-0 overflow-y-auto py-3 md:hidden">
          {groups.map((group) => (
            <section key={group.relation} className="mb-4">
              <h2 className="micro-label mb-2">{RELATION_LABEL[group.relation]} · {group.members.length}</h2>
              <div className="divide-y divide-hairline border-y border-hairline">
                {group.members.map((candidate) => (
                  <Button
                    key={candidate.link.link_id}
                    type="button"
                    variant="ghost"
                    className={`h-12 w-full justify-start rounded-none px-1 ${statusOf(candidate, reviewed) === "discarded" ? "opacity-50" : ""}`}
                    onClick={() => {
                      setSelectedId(candidate.link.link_id);
                      setMobileDetailOpen(true);
                    }}
                  >
                    {candidate.item ? <SourceMark item={candidate.item} size={14} /> : null}
                    <span className="min-w-0 flex-1 truncate text-left text-[13px]">
                      {candidate.item?.title ?? "Unavailable conversation"}
                    </span>
                    <span className="micro-label shrink-0">{RELATION_LABEL[group.relation]}</span>
                  </Button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="flex h-14 shrink-0 items-center gap-2 border-t border-hairline bg-background px-1 md:px-3">
        <p className="min-w-0 flex-1 truncate font-hand text-[16px] text-green">
          Kept {keptCount} of {candidates.length} · goes on the record of this deck
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void onKeepAll()}>
          Keep all
        </Button>
        <Button type="button" size="sm" onClick={() => void onDone()}>Done</Button>
      </footer>

      {mobileDetailOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/20 md:hidden" role="dialog" aria-modal="true" aria-label="Source detail">
          <Button type="button" variant="ghost" className="absolute inset-0 h-full w-full rounded-none" aria-label="Close source detail" onClick={() => setMobileDetailOpen(false)} />
          <div className="relative z-10 max-h-[78dvh] w-full overflow-y-auto rounded-t-[8px] border border-hairline bg-background p-5 shadow-[var(--shadow-modal)]">
            <CandidateDetail
              candidate={selected}
              onKeep={() => act("confirmed")}
              onReject={() => act("discarded")}
              onOpen={selected.item ? () => onOpenThread(selected.item?.id ?? "") : null}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}