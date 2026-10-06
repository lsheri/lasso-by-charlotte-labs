import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";

import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import type { LabLink, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { ToolBadge } from "@/components/onboarding/ToolBadge";
import type { ToolId } from "@/lib/onboarding-tools";
import type { Register } from "@/lib/register";
import { TOUR_BOARD_LAYOUT, actById, tourAmbientCards, tourBoardCopy, type TourAmbientCard, type TourCard, type TourLayoutItem, type TourSource, type TourActId } from "@/lib/tour-content";

const noop = () => undefined;

function sourceTool(source: TourSource): ToolId {
  if (source === "drive") return "googledrive";
  if (source === "email") return "gmail";
  return source;
}

export type TourBoardState = {
  act: TourActId;
  landedFile?: string | null;
  outlinedIds?: readonly string[];
  selectedIds?: readonly string[];
  groupedIds?: readonly string[];
  glowingIds?: readonly string[];
  highlightedTitle?: string | null;
  answerVisible?: boolean;
  connectorsVisible?: boolean;
  reducedMotion?: boolean;
  askOpen?: boolean;
};

type TourBoardProps = {
  register: Register;
  state: TourBoardState;
  className?: string;
  children?: ReactNode;
  onWorkCardSelect?: (index: number) => void;
  onWorkCardKeyDown?: (index: number, event: KeyboardEvent<HTMLElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: () => void;
  boardRef?: RefObject<HTMLDivElement | null>;
};

function itemStyle(item: TourLayoutItem) {
  return {
    left: `${item.x}%`,
    top: `${item.y}%`,
    width: `${item.widthBasis}%`,
    transform: `rotate(${item.rotation}deg)`,
  };
}

function PreviewCard({ card, compact = false }: { card: TourCard | TourAmbientCard; compact?: boolean }) {
  const preview = "excerpt" in card ? card.excerpt : card.preview;
  return <>
    <ToolBadge tool={sourceTool(card.source)} size="sm" />
    <strong>{card.title}</strong>
    {!compact ? <div className="tour-card-preview-copy"><span>{preview[0]}</span><span>{preview[1]}</span></div> : null}
  </>;
}

function ArtifactPreview() {
  return <article className="tour-compact-card" aria-label="Artifact preview"><ToolBadge tool="claude" size="sm" /><strong>Artifact</strong></article>;
}

function ImageCard({ kind, title, caption }: { kind: "deck" | "whiteboard"; title: string; caption?: string }) {
  const deck = kind === "deck";
  if (deck) return <article className="tour-compact-card tour-mini-slide" aria-label={title}>
    <span className="tour-compact-tool">Slide 12</span>
    <strong>{title}</strong>
    <h3>Fall launch recommendation</h3>
    <div className="tour-mini-slide-body">
      <ul><li>Retail leads the mix</li><li>Austin + Denver</li><li>Starts 29 Sep</li></ul>
      <svg viewBox="0 0 84 54" role="img" aria-label="Decorative four bar chart">
        <path d="M8 5v41h70" />
        <rect x="16" y="30" width="10" height="16" />
        <rect x="31" y="20" width="10" height="26" />
        <rect x="46" y="12" width="10" height="34" />
        <rect x="61" y="25" width="10" height="21" />
      </svg>
    </div>
  </article>;
  return <article className="tour-compact-card tour-screenshot-card" aria-label={title}>
    <span className="tour-compact-tool">Screenshot</span>
    <strong>{title}</strong>
    <svg viewBox="0 0 180 100" role="img" aria-label="Retail launch page screenshot frame">
      <rect className="tour-shot-window" x="1" y="1" width="178" height="98" rx="3" />
      <path className="tour-shot-rule" d="M1 15h178" />
      <circle cx="9" cy="8" r="2" /><circle cx="16" cy="8" r="2" /><circle cx="23" cy="8" r="2" />
      <rect className="tour-shot-image" x="10" y="25" width="70" height="55" rx="2" />
      <rect x="92" y="28" width="66" height="7" rx="2" />
      <rect x="92" y="42" width="52" height="4" rx="2" />
      <rect x="92" y="51" width="58" height="4" rx="2" />
      <rect x="92" y="66" width="36" height="10" rx="2" />
      <rect x="10" y="87" width="148" height="3" rx="1.5" />
    </svg>
    {caption ? <span className="tour-image-caption">{caption}</span> : null}
  </article>;
}

const BOARD_NOTES = [
  { id: "group", targetId: "primary-2", text: "name this grouping?", x: 83, y: 22 },
  { id: "gemini", targetId: "artifact", text: "add the Toronto numbers?", x: 85.5, y: 61.5 },
] as const;

function answerNode(register: Register): LabNode {
  const item = TOUR_BOARD_LAYOUT.find((candidate) => candidate.id === "answer");
  const claims = actById(register, 6)?.answer ?? [];
  return {
    id: "tour-answer", kind: "answer", frame: null, title: "Answer",
    summary: claims.map((claim) => claim.text).join(" "), typeLabel: "answer",
    ownership: "draft", local: false, authorName: "you", x: item?.x ?? 0,
    y: item?.y ?? 0, width: item?.widthBasis ?? 30, height: 18,
  };
}

function BoardRelationships({ register }: { register: Register }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geometry, setGeometry] = useState<{ width: number; height: number; nodes: LabNode[]; links: LabLink[] } | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    const board = svg?.parentElement;
    if (!svg || !board) return;
    const measure = () => {
      const base = board.getBoundingClientRect();
      const answer = board.querySelector<HTMLElement>('[data-tour-layout-id="deliverable"]') ?? board.querySelector<HTMLElement>('[data-tour-layout-id="answer"]');
      const targetTitle = answer?.dataset["tourTitle"] ?? "Answer";
      const sources = Array.from(board.querySelectorAll<HTMLElement>("[data-tour-connector-source]"));
      if (!answer || sources.length !== 3) return;
      const answerRect = answer.getBoundingClientRect();
      const sourceNodes = sources.map((element, index) => {
        const rect = element.getBoundingClientRect();
        return { id: `source-${index}`, kind: "source", frame: null, title: element.dataset["tourTitle"] ?? "Source work card", summary: "", typeLabel: "source", ownership: "draft", x: rect.left - base.left, y: rect.top - base.top, width: rect.width, height: rect.height } as LabNode;
      });
      const endpoints = sourceNodes.map((_, index) => ({ ...answerNode(register), title: targetTitle, id: `answer-anchor-${index}`, x: answerRect.left - base.left, y: answerRect.top - base.top + answerRect.height * ((index + 1) / 4), width: 1, height: 1 }));
      const links = sourceNodes.map((node, index) => ({ id: `tour-link-${index}`, fromId: node.id, toId: endpoints[index]?.id ?? "tour-answer", fromAnchor: "right" as const, toAnchor: "left" as const }));
      setGeometry({ width: base.width, height: base.height, nodes: [...sourceNodes, ...endpoints], links });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    for (const element of board.querySelectorAll<HTMLElement>("[data-tour-connector-source], [data-tour-layout-id=answer], [data-tour-layout-id=deliverable]")) observer.observe(element);
    return () => observer.disconnect();
  }, [register]);
  return <svg ref={svgRef} className="tour-keep-links" viewBox={geometry ? `0 0 ${geometry.width} ${geometry.height}` : "0 0 1 1"} aria-label="Links back to the three source work cards">
    {geometry ? <LabRelationships links={geometry.links} nodes={geometry.nodes} measuredHeights={new Map()} selectedLinkId={null} inverseZoom={1} onSelect={noop} /> : null}
  </svg>;
}

export function TourBoard({ register, state, className = "", children, onWorkCardSelect, onWorkCardKeyDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, boardRef }: TourBoardProps) {
  const cards = actById(register, 4)?.cards ?? [];
  const ambientCards = tourAmbientCards(register);
  const boardCopy = tourBoardCopy(register);
  const selected = new Set(state.selectedIds ?? []);
  const outlined = new Set(state.outlinedIds ?? []);
  const grouped = new Set(state.groupedIds ?? []);
  const glowing = new Set(state.glowingIds ?? []);
  const visible = (item: TourLayoutItem) => item.earliestAct <= state.act && !(item.id === "primary-2" && state.act === 3 && !state.landedFile);
  const answer = useMemo(() => answerNode(register), [register]);

  return <div ref={boardRef} className={`tour-persistent-board ${className}`} data-tour-board="" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
    <div className="tour-board-grid" aria-label="Workstream board">
      <>
        <header className="tour-board-heading"><strong>{boardCopy.title}</strong><span>{boardCopy.owner} · {boardCopy.pieceCount} pieces</span></header>
        <i className="tour-alignment-rail is-upper" aria-hidden /><i className="tour-alignment-rail is-lower" aria-hidden />
        {BOARD_NOTES.map((note) => <span key={note.id} className="tour-margin-note" data-tour-note={note.id} data-tour-note-target={note.targetId} style={{ left: `${note.x}%`, top: `${note.y}%` }}>{note.text}</span>)}
        {state.answerVisible ? <span className="tour-margin-note is-answer-note" data-tour-note="answer">this is the one to send</span> : null}
      </>
      <div className="tour-loose-work-label" aria-label="Loose AI chat work cards" />
      {state.groupedIds?.length ? <div className="tour-shared-group-region tour-region is-grouped" aria-label={`${actById(register, 5)?.frameTitle ?? "Workstream"} with three source work cards`}><span>{actById(register, 5)?.frameTitle}</span><span className="sr-only">{Array.from(grouped).map((id) => cards[Number(id.split("-")[1])]?.title).filter(Boolean).join(", ")}</span></div> : null}
      {TOUR_BOARD_LAYOUT.map((item) => {
        if (!visible(item)) return item.id === "answer" || item.id === "primary-2" ? <div key={item.id} className="tour-reserved-slot" data-tour-layout-id={item.id} data-tour-reserved="" style={itemStyle(item)} /> : null;
        if (item.kind === "primary") {
          const index = Number(item.id.split("-")[1]);
          const card = cards[index];
          if (!card) return null;
          const interactive = state.act === 4;
          return <article key={item.id} className={`tour-board-item tour-preview-card${outlined.has(item.id) ? " is-target-work" : ""}${selected.has(item.id) ? " is-selected" : ""}${glowing.has(item.id) ? " is-group-glowing" : ""}${state.highlightedTitle === card.title ? " is-source-highlighted" : ""}`} data-tour-layout-id={item.id} data-tour-card={`tour-card-${index}`} data-tour-title={card.title} data-tour-connector-source={grouped.has(item.id) ? item.id : undefined} data-tour-target={item.id === "primary-0" && state.act === 4 && !selected.has(item.id) ? "4" : undefined} role={interactive ? "group" : undefined} tabIndex={interactive ? 0 : undefined} style={itemStyle(item)} onClick={interactive ? () => onWorkCardSelect?.(index) : undefined} onKeyDown={interactive ? (event) => onWorkCardKeyDown?.(index, event) : undefined}>
             <PreviewCard card={card} compact={!card.inSet} />
          </article>;
        }
        if (item.kind === "chat") {
          const index = Number(item.id.split("-")[1]);
          const card = ambientCards[index];
          return card ? <article key={item.id} className="tour-board-item tour-preview-card is-ambient" data-tour-layout-id={item.id} data-tour-card={`ambient-${index}`} data-tour-ambient="" style={itemStyle(item)}><PreviewCard card={card} /></article> : null;
        }
        if (item.id === "artifact") return <div key={item.id} className="tour-board-item" data-tour-layout-id={item.id} style={itemStyle(item)}><ArtifactPreview /></div>;
        if (item.id === "whiteboard" || item.id === "deck") return <div key={item.id} className="tour-board-item" data-tour-layout-id={item.id} style={itemStyle(item)}><ImageCard kind={item.id} title={item.id === "whiteboard" ? boardCopy.whiteboardTitle : boardCopy.deckTitle} {...(item.id === "whiteboard" ? { caption: boardCopy.whiteboardCaption } : {})} /></div>;
        if (item.id === "answer" && state.answerVisible) return <div key={item.id} className="tour-board-item tour-answer-slot" data-tour-layout-id="answer" style={itemStyle(item)}><LabAnswerCard node={{ ...answer, x: 0, y: 0, width: 100, height: 100 }} focused={false} stackZ={4} onFocus={noop} onPointerDown={noop} onDelete={noop} /></div>;
        return null;
      })}
      {state.connectorsVisible ? <BoardRelationships register={register} /> : null}
      {children}
    </div>
  </div>;
}