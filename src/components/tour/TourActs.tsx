import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { BoardShell } from "@/components/board/BoardShell";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabFrame as LabFrameElement } from "@/components/canvas-lab/LabFrame";
import type { LabFrame, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { EvidenceCircle, GraphiteRule } from "@/components/notebook/marks";
import { ToolBadge } from "@/components/onboarding/ToolBadge";
import { Button } from "@/components/ui/button";
import { keyTo } from "@/lib/canvas-drag";
import { seededRand } from "@/lib/journey-path";
import type { ToolId } from "@/lib/onboarding-tools";
import type { Register } from "@/lib/register";
import { TOUR_CONTENT, type TourCard, type TourSource } from "@/lib/tour-content";

const noop = () => undefined;
const BOARD_POINT = { x: 72, y: 82 };
const CARD_SIZE = { width: 190, height: 92 };

type TourNode = LabNode & { source: TourSource; inSet: boolean };
type DragFile = { title: string; pointerId: number; x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

function sourceTool(source: TourSource): ToolId {
  if (source === "drive") return "googledrive";
  if (source === "email") return "gmail";
  return source;
}

function nodeFor(card: TourCard, index: number): TourNode {
  return {
    id: `tour-card-${index}`,
    kind: "source",
    frame: null,
    title: card.title,
    summary: "",
    typeLabel: card.source,
    ownership: "draft",
    x: 32 + (index % 3) * 218,
    y: 46 + Math.floor(index / 3) * 130,
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    source: card.source,
    inSet: card.inSet,
  };
}

function TourLabCard({ node, selected, hint, onSelect, onKeyDown }: {
  node: TourNode;
  selected: boolean;
  hint?: boolean;
  onSelect: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const localNode = { ...node, x: 0, y: 0 };
  return (
    <div className="tour-card-wrap" data-tour-card={node.id}>
      <span className="tour-card-source"><ToolBadge tool={sourceTool(node.source)} size="sm" /></span>
      <LabCard
        node={localNode}
        selected={selected}
        focused={selected}
        connecting={false}
        connectSourceAnchor={null}
        onSelect={onSelect}
        onOpen={noop}
        onBranch={noop}
        onHide={noop}
        onDelete={noop}
        onEdit={noop}
        onEditCommitted={noop}
        onAnchorPointerDown={noop}
        onAnchorActivate={noop}
        onMenuOpened={noop}
        onMenuOpenChange={noop}
        onMeasure={noop}
        onPointerDown={onSelect}
        onFocus={noop}
        onKeyDown={onKeyDown}
        canResize={false}
        onResizeStart={noop}
        onFit={noop}
        onResizeKeyDown={noop}
        onResizeKeyUp={noop}
        frameChoices={[]}
        structured={false}
        onMoveToFrame={noop}
      />
      {hint ? <EvidenceCircle className="tour-card-hint" /> : null}
    </div>
  );
}

function DrawnFileGlyph({ seed }: { seed: string }) {
  const rand = useMemo(() => seededRand(["tour-file", seed]), [seed]);
  const a = 2 + rand(1) * 1.2;
  const b = 13 + rand(2) * 1.1;
  return (
    <svg viewBox="0 0 20 24" aria-hidden className="tour-file-glyph">
      <path d={`M${a} 1.5 L13 1.5 L18 6.5 L18 ${22 - rand(3)} L2 22 Z`} />
      <path d="M13 1.5V7H18" />
      <path d={`M5 ${b} C8 ${b - 0.7} 11 ${b + 0.6} 15 ${b}`} />
      <path d={`M5 ${b + 4} C8 ${b + 3.5} 11 ${b + 4.6} 14 ${b + 4}`} />
    </svg>
  );
}

function FileWindow({ files, drag, onPointerDown, onKeyDown }: {
  files: readonly string[];
  drag: DragFile | null;
  onPointerDown: (title: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (title: string, event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <section className="tour-file-window" aria-label="Your files">
      <header><i aria-hidden /><strong>Your files</strong></header>
      <div>
        {files.map((file) => (
          <Button key={file} type="button" variant="ghost" className="tour-file-row" data-lifted={drag?.title === file} onPointerDown={(event) => onPointerDown(file, event)} onKeyDown={(event) => onKeyDown(file, event)}>
            <DrawnFileGlyph seed={file} />
            <span>{file}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}

export function TourActOne({ register, onComplete }: { register: Register; onComplete: (title: string) => void }) {
  const files = TOUR_CONTENT[register].acts[0]?.files ?? [];
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragFile | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [keyPosition, setKeyPosition] = useState({ x: 0, y: 0 });

  const land = (title: string) => {
    if (landed) return;
    setLanded(title);
    onComplete(title);
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const board = boardRef.current?.getBoundingClientRect();
    const inside = Boolean(board && event.clientX >= board.left && event.clientX <= board.right && event.clientY >= board.top && event.clientY <= board.bottom);
    if (event.pointerType === "touch" || inside) land(drag.title);
    setDrag(null);
    setKeyPosition({ x: 0, y: 0 });
  };

  const onFileKeyDown = (title: string, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (drag?.title === title) {
        land(title);
        setDrag(null);
      } else {
        setDrag({ title, pointerId: -1, x: 0, y: 0 });
      }
      return;
    }
    if (drag?.title !== title || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    setKeyPosition((current) => keyTo(current, event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", event.shiftKey));
  };

  const landedNode: TourNode[] = landed ? [{
    id: "tour-landed-file",
    kind: "source",
    frame: null,
    title: landed,
    summary: "",
    typeLabel: "file",
    ownership: "draft",
    x: BOARD_POINT.x,
    y: BOARD_POINT.y,
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    source: "drive",
    inSet: true,
  }] : [];

  return (
    <div className="tour-arrival" data-testid="tour-act-one" onPointerMove={(event) => {
      if (!drag || drag.pointerId < 0) return;
      setDrag((current) => current ? { ...current, x: event.clientX, y: event.clientY } : null);
    }} onPointerUp={finishPointer} onPointerCancel={() => setDrag(null)}>
      <FileWindow files={files} drag={drag} onPointerDown={(title, event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDrag({ title, pointerId: event.pointerId, x: event.clientX, y: event.clientY });
      }} onKeyDown={onFileKeyDown} />
      <div ref={boardRef} className="tour-arrival-board" data-testid="tour-drop-board">
        <BoardShell ariaLabel="Empty tour board" frames={[]} nodes={landedNode} lockZoom renderNode={(node) => <TourLabCard node={node} selected={false} onSelect={noop} onKeyDown={noop} />} />
        {landedNode.length === 0 ? <GraphiteRule className="tour-empty-rule" animated={false} /> : null}
      </div>
      {drag ? <div className="tour-file-drag" data-keyboard={drag.pointerId < 0} style={drag.pointerId < 0 ? { transform: `translate(${keyPosition.x}px, ${keyPosition.y}px)` } : { left: drag.x, top: drag.y }}><DrawnFileGlyph seed={drag.title} /><span>{drag.title}</span></div> : null}
    </div>
  );
}

export function TourActTwo({ register, hint, onComplete, onCaptionChange }: { register: Register; hint: boolean; onComplete: () => void; onCaptionChange?: (caption: string | null) => void }) {
  const cards = TOUR_CONTENT[register].acts[1]?.cards ?? [];
  const nodes = useMemo(() => cards.map(nodeFor), [cards]);
  const [selected, setSelected] = useState<string[]>([]);
  const [box, setBox] = useState<Box | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const completeRef = useRef(false);

  const applySelection = (ids: string[]) => {
    setSelected(ids);
    const required = nodes.filter((node) => node.inSet).map((node) => node.id);
    if (!completeRef.current && required.every((id) => ids.includes(id))) {
      completeRef.current = true;
      onCaptionChange?.("Those three are the set.");
      onComplete();
    }
  };
  const toggle = (id: string) => applySelection(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);

  const endBox = () => {
    if (!box || !boardRef.current) { setBox(null); return; }
    const board = boardRef.current.getBoundingClientRect();
    const left = board.left + box.x;
    const top = board.top + box.y;
    const right = left + box.width;
    const bottom = top + box.height;
    const picked = Array.from(boardRef.current.querySelectorAll<HTMLElement>("[data-tour-card]")).flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top ? [element.dataset["tourCard"] ?? ""] : [];
    }).filter(Boolean);
    applySelection(picked);
    setBox(null);
    startRef.current = null;
  };

  return (
    <div ref={boardRef} className="tour-board-act" data-testid="tour-act-two" onPointerDown={(event) => {
      if ((event.target as HTMLElement).closest("[data-tour-card]")) return;
      const rect = event.currentTarget.getBoundingClientRect();
      startRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setBox({ x: event.clientX - rect.left, y: event.clientY - rect.top, width: 0, height: 0 });
    }} onPointerMove={(event) => {
      const start = startRef.current;
      if (!start) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setBox({ x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) });
    }} onPointerUp={endBox} onPointerCancel={() => { setBox(null); startRef.current = null; }}>
      <BoardShell ariaLabel="Tour selection board" frames={[]} nodes={nodes} selectedIds={selected} lockZoom renderNode={(node) => <TourLabCard node={node} selected={selected.includes(node.id)} hint={hint && node.inSet} onSelect={() => toggle(node.id)} onKeyDown={(event) => { if (event.code === "Space") { event.preventDefault(); toggle(node.id); } }} />} />
      {box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}
    </div>
  );
}

export function TourActThree({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const act = TOUR_CONTENT[register].acts[2];
  const cards = TOUR_CONTENT[register].acts[1]?.cards ?? [];
  const chosen = cards.filter((card) => card.inSet);
  const [grouped, setGrouped] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => chosen.map((card, index) => ({ ...nodeFor(card, index), x: 52 + index * 205, y: 104, frame: grouped ? "tour-group" : null })), [chosen, grouped]);
  const frame: LabFrame = { id: "tour-group", name: act?.frameTitle ?? "", x: 28, y: 58, width: 650, height: 196 };

  const group = () => {
    if (grouped || nodes.length !== 3) return;
    setGrouped(true);
    onComplete();
  };

  const endBox = () => {
    if (!box || !boardRef.current) { setBox(null); return; }
    const board = boardRef.current.getBoundingClientRect();
    const left = board.left + box.x;
    const top = board.top + box.y;
    const right = left + box.width;
    const bottom = top + box.height;
    const cardRects = Array.from(boardRef.current.querySelectorAll<HTMLElement>("[data-tour-card]")).map((element) => element.getBoundingClientRect());
    if (cardRects.length === 3 && cardRects.every((rect) => left <= rect.left && top <= rect.top && right >= rect.right && bottom >= rect.bottom)) group();
    setBox(null);
    startRef.current = null;
  };

  return (
    <div className="tour-group-act" data-testid="tour-act-three" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); group(); } }}>
      <div ref={boardRef} className="tour-board-act" tabIndex={0} onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("[data-tour-card],button")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        startRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        setBox({ x: event.clientX - rect.left, y: event.clientY - rect.top, width: 0, height: 0 });
      }} onPointerMove={(event) => {
        const start = startRef.current;
        if (!start) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setBox({ x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) });
      }} onPointerUp={endBox} onPointerCancel={() => { setBox(null); startRef.current = null; }}>
        <BoardShell ariaLabel="Tour grouping board" frames={grouped ? [frame] : []} nodes={nodes} selectedIds={nodes.map((node) => node.id)} lockZoom renderFrame={(current) => <LabFrameElement frame={{ ...current, x: 0, y: 0 }} count={3} kind="custom" selected={false} editable={false} custom namedByWorkstream={false} removable={false} onSelect={noop} onResizeStart={noop} onFit={noop} onRename={noop} onRemove={noop} onMenuOpened={noop} onMenuOpenChange={noop} />} renderNode={(node) => <TourLabCard node={node} selected onSelect={noop} onKeyDown={noop} />} />
        {box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}
      </div>
      <Button type="button" variant="ink" className="tour-group-action" onClick={group}>Group</Button>
      {grouped ? <p className="tour-context-sentence">{act?.contextSentence}</p> : null}
    </div>
  );
}

export function useTourActRenderers({ register, activeAct, onAdvance, onHintShown }: { register: Register; activeAct: 1 | 2 | 3 | 4 | 5; onAdvance: (act: 1 | 2 | 3) => void; onHintShown: (act: number) => void }) {
  const [hintAct, setHintAct] = useState<number | null>(null);
  const [captionOverride, setCaptionOverride] = useState<string | null>(null);

  useEffect(() => {
    setHintAct(null);
    setCaptionOverride(null);
  }, [activeAct, register]);

  const hint = (act: number) => {
    setHintAct(act);
    onHintShown(act);
  };

  const renderers = useMemo(() => [
    { content: <TourActOne register={register} onComplete={() => onAdvance(1)} /> },
    { content: <TourActTwo register={register} hint={hintAct === 2} onCaptionChange={setCaptionOverride} onComplete={() => onAdvance(2)} /> },
    { content: <TourActThree register={register} onComplete={() => onAdvance(3)} /> },
    { content: <div className="tour-coming-act" aria-label="Act four preview" /> },
    { content: <div className="tour-coming-act" aria-label="Act five preview" /> },
  ], [hintAct, onAdvance, register]);

  return { renderers, captionOverride, hint };
}