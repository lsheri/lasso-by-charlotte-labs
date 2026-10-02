import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { BoardShell } from "@/components/board/BoardShell";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { LabFrame as LabFrameElement } from "@/components/canvas-lab/LabFrame";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import type { LabFrame, LabLink, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
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

function nodeFor(card: TourCard, index: number, compact = false): TourNode {
  const column = compact ? index % 2 : index % 3;
  const row = compact ? Math.floor(index / 2) : Math.floor(index / 3);
  return {
    id: `tour-card-${index}`,
    kind: "source",
    frame: null,
    title: card.title,
    summary: "",
    typeLabel: card.source,
    ownership: "draft",
    x: compact ? 10 + column * 157 : 32 + column * 218,
    y: compact ? 22 + row * 122 : 46 + row * 130,
    width: compact ? 145 : CARD_SIZE.width,
    height: compact ? 96 : CARD_SIZE.height,
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
  const [boardWidth, setBoardWidth] = useState(720);
  const compact = boardWidth < 500;
  const nodes = useMemo(() => cards.map((card, index) => nodeFor(card, index, compact)), [cards, compact]);
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
      <BoardShell ariaLabel="Tour selection board" frames={[]} nodes={nodes} selectedIds={selected} lockZoom onViewportSizeChange={({ width }) => setBoardWidth(width)} renderNode={(node) => <TourLabCard node={node} selected={selected.includes(node.id)} hint={hint && node.inSet} onSelect={() => toggle(node.id)} onKeyDown={(event) => { if (event.code === "Space") { event.preventDefault(); toggle(node.id); } }} />} />
      {box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}
    </div>
  );
}

export function TourActThree({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const act = TOUR_CONTENT[register].acts[2];
  const cards = TOUR_CONTENT[register].acts[1]?.cards ?? [];
  const chosen = cards.filter((card) => card.inSet);
  const [grouped, setGrouped] = useState(false);
  const [boardWidth, setBoardWidth] = useState(720);
  const [box, setBox] = useState<Box | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const compact = boardWidth < 500;
  const nodes = useMemo(() => chosen.map((card, index) => ({
    ...nodeFor(card, index, compact),
    x: compact ? 34 : 52 + index * 205,
    y: compact ? 54 + index * 84 : 104,
    width: compact ? 250 : CARD_SIZE.width,
    height: compact ? 70 : CARD_SIZE.height,
    frame: grouped ? "tour-group" : null,
  })), [chosen, compact, grouped]);
  const frame: LabFrame = compact
    ? { id: "tour-group", name: act?.frameTitle ?? "", x: 16, y: 18, width: 286, height: 298 }
    : { id: "tour-group", name: act?.frameTitle ?? "", x: 28, y: 58, width: 650, height: 196 };

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
        <BoardShell ariaLabel="Tour grouping board" frames={grouped ? [frame] : []} nodes={nodes} selectedIds={nodes.map((node) => node.id)} lockZoom onViewportSizeChange={({ width }) => setBoardWidth(width)} renderFrame={(current) => <LabFrameElement frame={{ ...current, x: 0, y: 0 }} count={3} kind="custom" selected={false} editable={false} custom namedByWorkstream={false} removable={false} onSelect={noop} onResizeStart={noop} onFit={noop} onRename={noop} onRemove={noop} onMenuOpened={noop} onMenuOpenChange={noop} />} renderNode={(node) => <TourLabCard node={node} selected onSelect={noop} onKeyDown={noop} />} />
        {box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}
      </div>
      <Button type="button" variant="ink" className="tour-group-action" onClick={group}>Group</Button>
      {grouped ? <p className="tour-context-sentence">{act?.contextSentence}</p> : null}
    </div>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function TourAskMimic({ register, visibleClaims, generating, onAsk }: {
  register: Register;
  visibleClaims: number;
  generating: boolean;
  onAsk: () => void;
}) {
  const act = TOUR_CONTENT[register].acts[3];
  return (
    <aside className="tour-ask-mimic" aria-label="Ask Lasso tour example">
      <header>
        <LassoLoopMark className={generating ? "tour-ask-loop is-generating" : "tour-ask-loop"} />
        <strong>Ask Lasso</strong>
      </header>
      <div className="tour-ask-question" aria-label="Preset question" aria-readonly="true">
        {act?.question}
      </div>
      <div className="tour-ask-claims" aria-live="polite">
        {(act?.answer ?? []).slice(0, visibleClaims).map((claim) => (
          <article key={claim.sourceCardTitle} className="tour-ask-claim">
            <p>{claim.text}</p>
            <span>{claim.sourceCardTitle}</span>
          </article>
        ))}
      </div>
      <Button type="button" variant="ink" onClick={onAsk} disabled={generating || visibleClaims === 3}>Ask</Button>
    </aside>
  );
}

function TourFramedSources({ register, highlightedTitle }: { register: Register; highlightedTitle?: string | null }) {
  const title = TOUR_CONTENT[register].acts[2]?.frameTitle ?? "";
  const cards = (TOUR_CONTENT[register].acts[1]?.cards ?? []).filter((card) => card.inSet);
  return (
    <section className="tour-source-frame" aria-label={`${title} with three source cards`}>
      <span className="tour-source-frame-title">{title}</span>
      {cards.map((card) => (
        <article key={card.title} className="tour-source-mini" data-highlighted={card.title === highlightedTitle ? "true" : undefined}>
          <ToolBadge tool={sourceTool(card.source)} size="sm" />
          <strong>{card.title}</strong>
        </article>
      ))}
    </section>
  );
}

export function TourActFour({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const claims = TOUR_CONTENT[register].acts[3]?.answer ?? [];
  const reduced = useReducedMotion();
  const [visibleClaims, setVisibleClaims] = useState(0);
  const [generating, setGenerating] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const ask = () => {
    if (generating || visibleClaims === claims.length) return;
    setGenerating(true);
    if (reduced) {
      setVisibleClaims(claims.length);
      setGenerating(false);
      onComplete();
      return;
    }
    claims.forEach((_, index) => {
      const timer = window.setTimeout(() => {
        setVisibleClaims(index + 1);
        if (index === claims.length - 1) {
          setGenerating(false);
          onComplete();
        }
      }, 400 * (index + 1));
      timers.current.push(timer);
    });
  };
  const highlighted = visibleClaims > 0 ? claims[visibleClaims - 1]?.sourceCardTitle : null;

  return (
    <div className="tour-ask-act" data-testid="tour-act-four">
      <TourFramedSources register={register} highlightedTitle={highlighted} />
      <TourAskMimic register={register} visibleClaims={visibleClaims} generating={generating} onAsk={ask} />
    </div>
  );
}

function answerNode(register: Register): LabNode {
  const claims = TOUR_CONTENT[register].acts[3]?.answer ?? [];
  return {
    id: "tour-answer",
    kind: "answer",
    frame: "tour-keep-frame",
    title: "Answer",
    summary: claims.map((claim) => claim.text).join(" "),
    typeLabel: "answer",
    ownership: "draft",
    local: false,
    authorName: "you",
    x: 375,
    y: 60,
    width: 260,
    height: 190,
  };
}

export function TourActFive({ register, onLanded }: { register: Register; onLanded: () => void }) {
  const cards = (TOUR_CONTENT[register].acts[1]?.cards ?? []).filter((card) => card.inSet);
  const [landed, setLanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const sourceNodes: LabNode[] = cards.map((card, index) => ({
    id: `tour-source-${index}`,
    kind: "source",
    frame: "tour-keep-frame",
    title: card.title,
    summary: "",
    typeLabel: card.source,
    ownership: "draft",
    x: 30,
    y: 42 + index * 82,
    width: 250,
    height: 64,
  }));
  const answer = answerNode(register);
  const links: LabLink[] = sourceNodes.map((node, index) => ({
    id: `tour-link-${index}`,
    fromId: node.id,
    toId: answer.id,
    fromAnchor: "right",
    toAnchor: "left",
  }));
  const land = () => {
    if (landed) return;
    setLanded(true);
    setDragging(false);
    onLanded();
  };
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) land();
    else setDragging(false);
  };

  return (
    <div className="tour-keep-act" data-testid="tour-act-five" onPointerUp={finishDrag} onPointerCancel={() => setDragging(false)}>
      <div ref={boardRef} className="tour-keep-board" aria-label="Workstream board">
        <span className="tour-source-frame-title">{TOUR_CONTENT[register].acts[2]?.frameTitle}</span>
        {sourceNodes.map((node, index) => (
          <article key={node.id} className="tour-keep-source" style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
            <ToolBadge tool={sourceTool(cards[index]?.source ?? "drive")} size="sm" />
            <strong>{node.title}</strong>
          </article>
        ))}
        {landed ? (
          <>
            <svg className="tour-keep-links" viewBox="0 0 680 300" aria-label="Answer links to its three sources">
              <LabRelationships links={links} nodes={[...sourceNodes, answer]} measuredHeights={new Map()} selectedLinkId={null} inverseZoom={1} onSelect={noop} />
            </svg>
            <LabAnswerCard node={answer} focused={false} stackZ={4} onFocus={noop} onPointerDown={noop} onDelete={noop} />
          </>
        ) : null}
      </div>
      {!landed ? (
        <aside className="tour-keep-panel">
          <article className="tour-drag-answer" onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); setDragging(true); }}>
            <span>Answer</span>
            <p>{TOUR_CONTENT[register].acts[3]?.answer?.map((claim) => claim.text).join(" ")}</p>
          </article>
          <Button type="button" variant="ink" onClick={land}>Keep</Button>
        </aside>
      ) : null}
    </div>
  );
}

export function useTourActRenderers({ register, activeAct, onAdvance, onHintShown, onFinish }: { register: Register; activeAct: 1 | 2 | 3 | 4 | 5; onAdvance: (act: 1 | 2 | 3 | 4) => void; onHintShown: (act: number) => void; onFinish: () => void }) {
  const [hintAct, setHintAct] = useState<number | null>(null);
  const [captionOverride, setCaptionOverride] = useState<string | null>(null);
  const [answerLanded, setAnswerLanded] = useState(false);

  useEffect(() => {
    setHintAct(null);
    setCaptionOverride(null);
    setAnswerLanded(false);
  }, [activeAct, register]);

  const hint = (act: number) => {
    setHintAct(act);
    onHintShown(act);
  };

  const renderers = useMemo(() => [
    { content: <TourActOne register={register} onComplete={() => onAdvance(1)} /> },
    { content: <TourActTwo register={register} hint={hintAct === 2} onCaptionChange={setCaptionOverride} onComplete={() => onAdvance(2)} /> },
    { content: <TourActThree register={register} onComplete={() => onAdvance(3)} /> },
    { content: <TourActFour register={register} onComplete={() => onAdvance(4)} /> },
    {
      content: <TourActFive register={register} onLanded={() => { setAnswerLanded(true); setCaptionOverride(TOUR_CONTENT[register].acts[4]?.closingLine ?? null); }} />,
      primaryAction: answerLanded ? <Button type="button" variant="ink" onClick={onFinish}>{TOUR_CONTENT[register].acts[4]?.primaryActionLabel}</Button> : null,
    },
  ], [answerLanded, hintAct, onAdvance, onFinish, register]);

  return { renderers, captionOverride, hint };
}