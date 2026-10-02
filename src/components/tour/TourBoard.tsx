import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";

import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import type { LabLink, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { CircleMark } from "@/components/notebook/CircleMark";
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
  return <article className={`tour-image-card${deck ? " is-finished-deck" : ""}`} aria-label={deck ? "Finished deck, slide 12" : "Whiteboard photo"}>
    <strong>{deck ? "Deck, slide 12" : "Whiteboard photo"}</strong>
    <svg viewBox="0 0 320 150" aria-hidden>{deck ? <>
      <path className="tour-deck-title-line" d="M20 24 C92 22 174 26 260 23" />
      <path d="M22 55 C82 53 130 57 188 54 M22 72 C98 70 145 74 216 71 M22 89 C77 87 120 91 174 88" />
      <rect x="220" y="52" width="78" height="62" rx="3" />
      <path d="M231 104 V91 H243 V104 M250 104 V78 H262 V104 M269 104 V65 H281 V104 M229 105 H289" />
    </> : <>
      <rect x="12" y="14" width="38" height="22" rx="2" /><rect x="108" y="46" width="38" height="22" rx="2" />
      <rect x="61" y="28" width="38" height="22" rx="2" /><path d="M50 25 C57 24 58 32 64 34 M98 42 C105 42 107 50 111 53" />
      <path d="m59 31 5 3-5 3 M106 50 5 3-5 3" />
    </>}</svg>
    {deck ? <span className="tour-deck-footnote-marker" tabIndex={0} role="note" aria-label="This line came from Claude: positioning draft" data-tour-deck-marker="">
      <CircleMark><span aria-hidden>1</span></CircleMark>
    </span> : null}
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

type MeasuredPoint = { x: number; y: number };
type MeasuredPath = { id: string; label: string; points: MeasuredPoint[] };
type MeasuredRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

function pointsPath(points: readonly MeasuredPoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

function gridRoute(start: MeasuredPoint, end: MeasuredPoint, obstacles: readonly MeasuredRect[], width: number, height: number) {
  const step = 3;
  const columns = Math.ceil(width / step) + 1; const rows = Math.ceil(height / step) + 1;
  const cell = (point: MeasuredPoint) => ({ column: Math.max(0, Math.min(columns - 1, Math.round(point.x / step))), row: Math.max(0, Math.min(rows - 1, Math.round(point.y / step))) });
  const point = (column: number, row: number) => ({ x: column * step, y: row * step });
  const key = (column: number, row: number) => row * columns + column;
  const from = cell(start); const to = cell(end); const fromKey = key(from.column, from.row); const toKey = key(to.column, to.row);
  const blocked = (column: number, row: number) => {
    const value = point(column, row);
    return obstacles.some((rect) => value.x > rect.left - 4 && value.x < rect.right + 4 && value.y > rect.top - 4 && value.y < rect.bottom + 4);
  };
  const queue = [fromKey]; const previous = new Map<number, number>(); const visited = new Set([fromKey]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]; if (current === undefined || current === toKey) break;
    const column = current % columns; const row = Math.floor(current / columns);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nextColumn = column + dx; const nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
      const next = key(nextColumn, nextRow);
      if (visited.has(next) || (next !== toKey && blocked(nextColumn, nextRow))) continue;
      visited.add(next); previous.set(next, current); queue.push(next);
    }
  }
  if (!visited.has(toKey)) return null;
  const route: MeasuredPoint[] = []; let cursor: number | undefined = toKey;
  while (cursor !== undefined) { route.unshift(point(cursor % columns, Math.floor(cursor / columns))); cursor = previous.get(cursor); }
  route[0] = start; route[route.length - 1] = end;
  return route.filter((entry, index) => {
    const before = route[index - 1]; const after = route[index + 1];
    return !before || !after || !((before.x === entry.x && entry.x === after.x) || (before.y === entry.y && entry.y === after.y));
  });
}

function edgeAnchors(rect: MeasuredRect) {
  return [
    { edge: { x: rect.left + rect.width / 2, y: rect.top }, out: { x: rect.left + rect.width / 2, y: rect.top - 6 } },
    { edge: { x: rect.right, y: rect.top + rect.height / 2 }, out: { x: rect.right + 6, y: rect.top + rect.height / 2 } },
    { edge: { x: rect.left + rect.width / 2, y: rect.bottom }, out: { x: rect.left + rect.width / 2, y: rect.bottom + 6 } },
    { edge: { x: rect.left, y: rect.top + rect.height / 2 }, out: { x: rect.left - 6, y: rect.top + rect.height / 2 } },
  ];
}

function routeBetween(from: MeasuredRect, to: MeasuredRect, obstacles: readonly MeasuredRect[], width: number, height: number) {
  let best: MeasuredPoint[] | null = null; let bestLength = Infinity;
  for (const start of edgeAnchors(from)) for (const end of edgeAnchors(to)) {
    if (start.out.x < 1 || start.out.x > width - 1 || start.out.y < 1 || start.out.y > height - 1 || end.out.x < 1 || end.out.x > width - 1 || end.out.y < 1 || end.out.y > height - 1) continue;
    const middle = gridRoute(start.out, end.out, obstacles, width, height);
    if (!middle) continue;
    const route = [start.edge, ...middle, end.edge];
    const length = route.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - (route[index]?.x ?? point.x)) + Math.abs(point.y - (route[index]?.y ?? point.y)), 0);
    if (length < bestLength) { best = route; bestLength = length; }
  }
  return best ?? [{ x: from.right, y: from.top + from.height / 2 }, { x: to.left, y: to.top + to.height / 2 }];
}

function DeckRelationships() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geometry, setGeometry] = useState<{ width: number; height: number; paths: MeasuredPath[] } | null>(null);
  const pendingPaths: MeasuredPath[] = [0, 1, 2].map((index) => ({ id: `deck-source-${index}`, label: "Finished deck link to source work card", points: [] }));
  pendingPaths.push({ id: "deck-chat-trace", label: "Slide note 1 links to Claude: positioning draft", points: [] });
  useEffect(() => {
    const svg = svgRef.current;
    const board = svg?.parentElement;
    if (!svg || !board) return;
    const measure = () => {
      const base = board.getBoundingClientRect();
      const deck = board.querySelector<HTMLElement>('[data-tour-layout-id="deck"]');
      const marker = board.querySelector<HTMLElement>("[data-tour-deck-marker]");
      const claude = board.querySelector<HTMLElement>('[data-tour-title="Claude: positioning draft"]');
      const sources = ["primary-0", "primary-1", "primary-2"].map((id) => board.querySelector<HTMLElement>(`[data-tour-layout-id="${id}"]`));
      if (!deck || !marker || !claude || sources.some((source) => !source)) return;
      const normalize = (rect: DOMRect): MeasuredRect => ({ left: rect.left - base.left, top: rect.top - base.top, right: rect.right - base.left, bottom: rect.bottom - base.top, width: rect.width, height: rect.height });
      const deckRect = normalize(deck.getBoundingClientRect());
      const markerRect = normalize(marker.getBoundingClientRect());
      const claudeRect = normalize(claude.getBoundingClientRect());
      const sourceRects = sources.map((source) => source ? normalize(source.getBoundingClientRect()) : null).filter((source): source is MeasuredRect => source !== null);
      const itemRects = Array.from(board.querySelectorAll<HTMLElement>("[data-tour-layout-id]")).map((element) => ({ id: element.dataset["tourLayoutId"] ?? "", rect: normalize(element.getBoundingClientRect()) }));
      const paths: MeasuredPath[] = sourceRects.map((source, index) => {
        const obstacles = itemRects.filter((item) => item.id !== "deck" && item.id !== `primary-${index}`).map((item) => item.rect);
        return { id: `deck-source-${index}`, label: `Finished deck links to ${sources[index]?.dataset["tourTitle"] ?? "source work card"}`, points: routeBetween(deckRect, source, obstacles, base.width, Math.max(base.height, deckRect.bottom + 20)) };
      });
      const traceObstacles = itemRects.filter((item) => item.id !== "deck" && item.id !== "chat-3").map((item) => item.rect);
      paths.push({ id: "deck-chat-trace", label: "Slide note 1 links to Claude: positioning draft", points: routeBetween(markerRect, claudeRect, traceObstacles, base.width, Math.max(base.height, deckRect.bottom + 20)) });
      setGeometry({ width: base.width, height: Math.max(base.height, deckRect.bottom + 20), paths });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    for (const element of board.querySelectorAll<HTMLElement>('[data-tour-layout-id], [data-tour-deck-marker]')) observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <svg ref={svgRef} className="tour-deck-links" viewBox={geometry ? `0 0 ${geometry.width} ${geometry.height}` : "0 0 1 1"} aria-label="Finished deck links to its source work cards and Claude chat">
    <defs><marker id="tour-deck-arrow" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" viewBox="0 0 8 8"><path d="M0 0 L8 4 L0 8 Z" /></marker></defs>
    {(geometry?.paths ?? pendingPaths).map((path) => <path key={path.id} data-tour-deck-link={path.id} data-tour-points={JSON.stringify(path.points)} aria-label={path.label} d={pointsPath(path.points)} markerEnd="url(#tour-deck-arrow)" />)}
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
      {state.connectorsVisible ? <DeckRelationships /> : null}
      {children}
    </div>
    {state.act === 5 ? <div className="tour-board-scroll-space" aria-hidden /> : null}
  </div>;
}