import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";

import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import type { LabLink, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { ToolBadge } from "@/components/onboarding/ToolBadge";
import type { ToolId } from "@/lib/onboarding-tools";
import type { Register } from "@/lib/register";
import { TOUR_AMBIENT_CARDS, TOUR_BOARD_LAYOUT, TOUR_CONTENT, type TourCard, type TourLayoutItem, type TourSource } from "@/lib/tour-content";

const noop = () => undefined;

function sourceTool(source: TourSource): ToolId {
  if (source === "drive") return "googledrive";
  if (source === "email") return "gmail";
  return source;
}

export type TourBoardState = {
  act: 1 | 2 | 3 | 4 | 5;
  landedFile?: string | null;
  outlinedIds?: readonly string[];
  selectedIds?: readonly string[];
  groupedIds?: readonly string[];
  glowingIds?: readonly string[];
  highlightedTitle?: string | null;
  answerVisible?: boolean;
  connectorsVisible?: boolean;
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

function PreviewCard({ card }: { card: TourCard | (typeof TOUR_AMBIENT_CARDS)[number] }) {
  const preview = "excerpt" in card ? card.excerpt : card.preview;
  return <>
    <ToolBadge tool={sourceTool(card.source)} size="sm" />
    <strong>{card.title}</strong>
    <div className="tour-card-preview-copy"><span>{preview[0]}</span><span>{preview[1]}</span></div>
  </>;
}

function ArtifactPreview() {
  return <article className="tour-artifact-card is-strip" aria-label="Artifact preview"><span>Artifact</span><div aria-hidden><i /><i /><b /><b /></div></article>;
}

function ImageCard({ kind }: { kind: "deck" | "whiteboard" }) {
  const deck = kind === "deck";
  return <article className="tour-image-card" aria-label={deck ? "Deck, slide 12" : "Whiteboard photo"}>
    <strong>{deck ? "Deck, slide 12" : "Whiteboard photo"}</strong>
    <svg viewBox="0 0 160 82" aria-hidden>{deck ? <>
      <path d="M10 12 C52 11 105 13 150 11" /><path d="M12 27 H72 M12 35 H62" />
      <path d="M92 65 V48 H105 V65 M113 65 V37 H126 V65 M134 65 V25 H147 V65" />
    </> : <>
      <rect x="12" y="14" width="38" height="22" rx="2" /><rect x="108" y="46" width="38" height="22" rx="2" />
      <rect x="61" y="28" width="38" height="22" rx="2" /><path d="M50 25 C57 24 58 32 64 34 M98 42 C105 42 107 50 111 53" />
      <path d="m59 31 5 3-5 3 M106 50 5 3-5 3" />
    </>}</svg>
  </article>;
}

function answerNode(register: Register): LabNode {
  const item = TOUR_BOARD_LAYOUT.find((candidate) => candidate.id === "answer");
  const claims = TOUR_CONTENT[register].acts[3]?.answer ?? [];
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
      const answer = board.querySelector<HTMLElement>('[data-tour-layout-id="answer"]');
      const sources = Array.from(board.querySelectorAll<HTMLElement>("[data-tour-connector-source]"));
      if (!answer || sources.length !== 3) return;
      const answerRect = answer.getBoundingClientRect();
      const sourceNodes = sources.map((element, index) => {
        const rect = element.getBoundingClientRect();
        return { id: `source-${index}`, kind: "source", frame: null, title: element.dataset["tourTitle"] ?? "Source work card", summary: "", typeLabel: "source", ownership: "draft", x: rect.left - base.left, y: rect.top - base.top, width: rect.width, height: rect.height } as LabNode;
      });
      const endpoints = sourceNodes.map((_, index) => ({ ...answerNode(register), id: `answer-anchor-${index}`, x: answerRect.left - base.left, y: answerRect.top - base.top + answerRect.height * ((index + 1) / 4), width: 1, height: 1 }));
      const links = sourceNodes.map((node, index) => ({ id: `tour-link-${index}`, fromId: node.id, toId: endpoints[index]?.id ?? "tour-answer", fromAnchor: "right" as const, toAnchor: "left" as const }));
      setGeometry({ width: base.width, height: base.height, nodes: [...sourceNodes, ...endpoints], links });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    for (const element of board.querySelectorAll<HTMLElement>("[data-tour-connector-source], [data-tour-layout-id=answer]")) observer.observe(element);
    return () => observer.disconnect();
  }, [register]);
  return <svg ref={svgRef} className="tour-keep-links" viewBox={geometry ? `0 0 ${geometry.width} ${geometry.height}` : "0 0 1 1"} aria-label="Answer links to its three source work cards">
    {geometry ? <LabRelationships links={geometry.links} nodes={geometry.nodes} measuredHeights={new Map()} selectedLinkId={null} inverseZoom={1} onSelect={noop} /> : null}
  </svg>;
}

export function TourBoard({ register, state, className = "", children, onWorkCardSelect, onWorkCardKeyDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, boardRef }: TourBoardProps) {
  const cards = TOUR_CONTENT[register].acts[1]?.cards ?? [];
  const selected = new Set(state.selectedIds ?? []);
  const outlined = new Set(state.outlinedIds ?? []);
  const grouped = new Set(state.groupedIds ?? []);
  const glowing = new Set(state.glowingIds ?? []);
  const visible = (item: TourLayoutItem) => item.earliestAct <= state.act && !(item.id === "primary-0" && state.act === 1 && !state.landedFile);
  const answer = useMemo(() => answerNode(register), [register]);

  return <div ref={boardRef} className={`tour-persistent-board${state.act === 5 ? " is-act-five" : ""} ${className}`} data-tour-board="" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
    <div className="tour-board-grid" aria-label="Workstream board">
      <div className="tour-loose-work-label" aria-label="Loose AI chat work cards" />
      {state.groupedIds?.length ? <div className="tour-shared-group-region tour-region is-grouped" aria-label={`${TOUR_CONTENT[register].acts[2]?.frameTitle ?? "Workstream"} with three source work cards`}><span>{TOUR_CONTENT[register].acts[2]?.frameTitle}</span><span className="sr-only">{Array.from(grouped).map((id) => cards[Number(id.split("-")[1])]?.title).filter(Boolean).join(", ")}</span></div> : null}
      {TOUR_BOARD_LAYOUT.map((item) => {
        if (!visible(item) || (item.id === "deck" && !state.answerVisible)) return item.id === "answer" || item.id === "primary-0" || item.id === "deck" ? <div key={item.id} className={`tour-reserved-slot${item.id === "deck" ? " is-deck-slot" : ""}`} data-tour-layout-id={item.id} data-tour-reserved="" style={itemStyle(item)} /> : null;
        if (item.kind === "primary") {
          const index = Number(item.id.split("-")[1]);
          const card = cards[index];
          if (!card) return null;
          const title = item.id === "primary-0" && state.act === 1 && state.landedFile ? state.landedFile : card.title;
          const rendered = { ...card, title };
          const interactive = state.act === 2;
          return <article key={item.id} className={`tour-board-item tour-preview-card${outlined.has(item.id) ? " is-target-work" : ""}${selected.has(item.id) ? " is-selected" : ""}${glowing.has(item.id) ? " is-group-glowing" : ""}${state.highlightedTitle === card.title ? " is-source-highlighted" : ""}`} data-tour-layout-id={item.id} data-tour-card={`tour-card-${index}`} data-tour-title={card.title} data-tour-connector-source={grouped.has(item.id) ? item.id : undefined} role={interactive ? "group" : undefined} tabIndex={interactive ? 0 : undefined} style={itemStyle(item)} onClick={interactive ? () => onWorkCardSelect?.(index) : undefined} onKeyDown={interactive ? (event) => onWorkCardKeyDown?.(index, event) : undefined}>
            {item.id === "primary-0" && state.act === 2 ? <span className="tour-act-two-arrow-target" data-tour-target="2" aria-hidden /> : null}
            <PreviewCard card={rendered} />
          </article>;
        }
        if (item.kind === "chat") {
          const index = Number(item.id.split("-")[1]);
          const card = TOUR_AMBIENT_CARDS[index];
          return card ? <article key={item.id} className="tour-board-item tour-preview-card is-ambient" data-tour-layout-id={item.id} data-tour-card={`ambient-${index}`} data-tour-title={card.title} data-tour-ambient="" style={itemStyle(item)}><PreviewCard card={card} /></article> : null;
        }
        if (item.id === "artifact") return <div key={item.id} className="tour-board-item" data-tour-layout-id={item.id} style={itemStyle(item)}><ArtifactPreview /></div>;
        if (item.id === "whiteboard" || item.id === "deck") return <div key={item.id} className="tour-board-item" data-tour-layout-id={item.id} style={itemStyle(item)}><ImageCard kind={item.id} /></div>;
        if (item.id === "answer" && state.answerVisible) return <div key={item.id} className="tour-board-item tour-answer-slot" data-tour-layout-id="answer" style={itemStyle(item)}><LabAnswerCard node={{ ...answer, x: 0, y: 0, width: 100, height: 100 }} focused={false} stackZ={4} onFocus={noop} onPointerDown={noop} onDelete={noop} /></div>;
        return null;
      })}
      {state.connectorsVisible ? <BoardRelationships register={register} /> : null}
      {children}
    </div>
  </div>;
}