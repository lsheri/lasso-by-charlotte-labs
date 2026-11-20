import { useEffect, useState, type CSSProperties } from "react";

import { PersonFace } from "@/components/ui/person-face";
import { BOARD_WIN_COPY, REVEAL_COPY } from "@/lib/proposal-desk-shared";
import { cn } from "@/lib/utils";

/** Where each document lands on the little canvas, loosely, the way a fresh board places them. */
const SPOTS = [
  { left: "40%", top: "36%", turn: "-1.5deg" },
  { left: "67%", top: "30%", turn: "1deg" },
  { left: "47%", top: "66%", turn: ".5deg" },
  { left: "71%", top: "62%", turn: "-.8deg" },
];
const ARRIVE = "animate-in fade-in-0 zoom-in-50 slide-in-from-bottom-2 duration-700 motion-reduce:animate-none";
const at = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s`, animationFillMode: "both" });

/**
 * 20 Nov 2026 (Liam: "should look more like the figjam boards that are really created"). The board the win is making,
 * drawn as it will look: a dotted canvas, the board's toolbar, the win line with the lead, the brief card from the
 * notes, and each context document as a small picture with its owner's face, placed loosely, arriving one by one.
 * Captions name what the server is doing; the last one holds until the board opens. Nothing here is a real board yet,
 * so nothing on it can be pressed. Reduced motion shows it whole.
 */
export function BoardBuildReveal({
  client,
  documents,
  documentCount,
  lead,
  owner,
}: {
  client: string;
  /** The owner's own document titles; the win is only ever the owner's, so they may see them. */
  documents: readonly string[];
  documentCount: number;
  lead: string;
  owner: string;
}) {
  const stages = REVEAL_COPY.stages(client, documentCount, lead);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), REVEAL_COPY.stageMs);
    return () => window.clearInterval(timer);
  }, [stages.length]);
  const shown = Array.from({ length: Math.min(documentCount, SPOTS.length) }, (_, index) => documents[index] ?? "");
  const last = stage === stages.length - 1;

  return (
    <figure data-board-reveal aria-label={REVEAL_COPY.label} className="m-0 flex flex-col gap-3">
      <div
        aria-hidden="true"
        className="relative h-56 overflow-hidden rounded-[var(--radius-card)] border border-border bg-background [background-image:radial-gradient(color-mix(in_oklab,var(--foreground)_16%,transparent)_1px,transparent_1.3px)] [background-size:18px_18px] sm:h-64"
      >
        <div className={cn("absolute inset-x-3 top-2.5 flex h-9 items-center gap-2 rounded-full bg-card px-4 text-(length:--type-small) font-semibold shadow-card", ARRIVE)} style={at(0.3)}>
          <span className="min-w-0 flex-1 truncate">{client}</span>
          <span className="font-normal text-muted-foreground">{REVEAL_COPY.board}</span>
        </div>
        <div
          className={cn("absolute left-[3%] top-[26%] flex h-6 items-center gap-1.5 rounded-full bg-[var(--good-wash)] px-2.5 text-(length:--type-label) font-semibold", ARRIVE)}
          style={at(0.8)}
        >
          <span className="size-2 rounded-full bg-[var(--good-mark)] ring-[1.2px] ring-foreground" />
          {/* The lead has their own chip on the board, so the line says only the win. */}
          <span className="truncate">{BOARD_WIN_COPY.won("")}</span>
        </div>
        <div
          data-reveal-brief
          className={cn("absolute left-[3%] top-[40%] flex w-[33%] flex-col gap-1 rounded-[var(--radius-control)] bg-[var(--good-wash)] p-2.5 ring-[1.5px] ring-foreground", ARRIVE)}
          style={at(1.3)}
        >
          <span className="text-(length:--type-small) font-semibold">{REVEAL_COPY.brief}</span>
          <span className="text-(length:--type-label) text-muted-foreground">{REVEAL_COPY.briefLine}</span>
          <PersonFace name={owner} size="sm" className="size-5 text-(length:--type-label)" />
        </div>
        {shown.map((title, index) => {
          const spot = SPOTS[index] as (typeof SPOTS)[number];
          return (
            <div
              key={`${index}-${title}`}
              data-reveal-document
              className={cn("absolute flex w-[24%] flex-col gap-1.5 rounded-[var(--radius-control)] bg-card p-1.5 shadow-card", ARRIVE)}
              style={{ left: spot.left, top: spot.top, rotate: spot.turn, ...at(2 + index * 0.35) }}
            >
              <span className="h-8 rounded-[var(--radius-control)] border border-border bg-background [background-image:repeating-linear-gradient(transparent_0_6px,color-mix(in_oklab,var(--foreground)_14%,transparent)_6px_8px)] sm:h-10" />
              <span className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-(length:--type-label) font-semibold">{title || REVEAL_COPY.document}</span>
                <PersonFace name={owner} size="sm" className="size-5 text-(length:--type-label)" />
              </span>
            </div>
          );
        })}
        {lead ? (
          <div className={cn("absolute bottom-[6%] right-[3%] flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-3 text-(length:--type-label) font-semibold shadow-card", ARRIVE)} style={at(3.4)}>
            <PersonFace name={lead} size="sm" className="size-6" />
            {lead}
          </div>
        ) : null}
      </div>
      <figcaption role="status" className="flex items-center gap-2 text-(length:--type-small) font-medium">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", last ? "animate-pulse bg-[var(--good-mark)] ring-[1.2px] ring-foreground motion-reduce:animate-none" : "bg-muted-foreground")} />
        <span key={stage} className="animate-in fade-in-0 duration-500 motion-reduce:animate-none">
          {stages[stage]}
        </span>
      </figcaption>
    </figure>
  );
}
