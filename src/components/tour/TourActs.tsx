import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { TourBoard } from "@/components/tour/TourBoard";
import { WorkboardHeader, WorkboardSideRail, WorkboardToolbar } from "@/components/canvas-lab/WorkboardChrome";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { GraphiteIcon } from "@/components/notebook/icons";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { ToolBadge } from "@/components/onboarding/ToolBadge";
import { Button } from "@/components/ui/button";
import { keyTo } from "@/lib/canvas-drag";
import type { ToolId } from "@/lib/onboarding-tools";
import type { Register } from "@/lib/register";
import { TOUR_CONTENT, type TourSource } from "@/lib/tour-content";

const noop = () => undefined;
type DragFile = { title: string; pointerId: number; x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
const GROUP_IDS = ["primary-0", "primary-1", "primary-2"] as const;

function sourceTool(source: TourSource): ToolId {
  if (source === "drive") return "googledrive";
  if (source === "email") return "gmail";
  return source;
}

function DrawnFileGlyph({ seed }: { seed: string }) {
  const offset = (seed.length % 4) * 0.3;
  return <svg viewBox="0 0 20 24" aria-hidden className="tour-file-glyph">
    <path d={`M${2 + offset} 1.5 L13 1.5 L18 6.5 L18 21 L2 22 Z`} /><path d="M13 1.5V7H18" />
    <path d="M5 13 C8 12.3 11 13.6 15 13 M5 17 C8 16.5 11 17.6 14 17" />
  </svg>;
}

function FileWindow({ files, drag, onPointerDown, onKeyDown }: {
  files: readonly string[];
  drag: DragFile | null;
  onPointerDown: (title: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (title: string, event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return <section className="tour-file-window" aria-label="Your files"><header><i aria-hidden /><strong>Your files</strong></header><div>
    {files.map((file) => <Button key={file} type="button" variant="ghost" className="tour-file-row" data-lifted={drag?.title === file} onPointerDown={(event) => onPointerDown(file, event)} onKeyDown={(event) => onKeyDown(file, event)}><DrawnFileGlyph seed={file} /><span>{file}</span></Button>)}
  </div></section>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

type TourWorkboardTool = "add" | "select" | "group" | "ask" | null;
function TourWorkboard({ active, onAddWork, onGroup, onAsk, children }: { active: TourWorkboardTool; onAddWork?: () => void; onGroup?: () => void; onAsk?: () => void; children: ReactNode }) {
  const toolClass = (tool: Exclude<TourWorkboardTool, null>) => `tour-board-tool${active === tool ? " is-active" : ""}`;
  const toolbar = <WorkboardToolbar className="tour-board-toolbar" ariaLabel="Board tools">
    <Button type="button" size="icon" variant="outline" aria-label="Show workstreams" onClick={noop}><GraphiteIcon name="workstreams" size={20} /></Button>
    <Button type="button" size="sm" variant="outline" aria-label="Add work" data-toolbar-control="add-work" data-tour-target={active === "add" ? "1" : undefined} className={toolClass("add")} onClick={active === "add" ? onAddWork : noop}><GraphiteIcon name="work" size={20} /><span>Add work</span></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Select work" aria-pressed={active === "select"} className={toolClass("select")} onClick={noop}><GraphiteIcon name="connectors" size={20} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Add grouping" aria-pressed={active === "group"} data-tour-target={active === "group" ? "3" : undefined} className={toolClass("group")} onClick={active === "group" ? onGroup : noop}><GraphiteIcon name="grouping" size={20} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Ask Lasso" aria-pressed={active === "ask"} data-tour-target={active === "ask" ? "4" : undefined} className={toolClass("ask")} onClick={active === "ask" ? onAsk : noop}><LassoThinkingMark kind="signature" size={24} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Info" onClick={noop}><GraphiteIcon name="working-from" size={20} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Fit" onClick={noop}><GraphiteIcon name="fit" size={20} /></Button>
  </WorkboardToolbar>;
  return <div className="tour-workboard-chrome"><WorkboardSideRail menuControl={<Button type="button" size="icon" variant="ghost" aria-label="Open workboard menu" onClick={noop}><GraphiteIcon name="more" size={18} /></Button>} closeControl={<Button type="button" size="icon" variant="ghost" aria-label="Close workboard" onClick={noop}><GraphiteIcon name="close" size={18} /></Button>} /><div className="tour-workboard-main"><WorkboardHeader title="Your workboard" status="WORKBOARD" toolbar={toolbar} /><div className="tour-workboard-canvas">{children}</div></div></div>;
}

export function TourActOne({ register, onComplete }: { register: Register; onComplete: (title: string) => void }) {
  const files = TOUR_CONTENT[register].acts[0]?.files ?? [];
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragFile | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [keyPosition, setKeyPosition] = useState({ x: 0, y: 0 });
  const land = (title: string) => { if (landed) return; setLanded(title); setFilesOpen(false); onComplete(title); };
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const board = boardRef.current?.getBoundingClientRect();
    const inside = Boolean(board && event.clientX >= board.left && event.clientX <= board.right && event.clientY >= board.top && event.clientY <= board.bottom);
    if (event.pointerType === "touch" || inside) land(drag.title);
    setDrag(null); setKeyPosition({ x: 0, y: 0 });
  };
  const onFileKeyDown = (title: string, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.code === "Space") { event.preventDefault(); if (drag?.title === title) { land(title); setDrag(null); } else setDrag({ title, pointerId: -1, x: 0, y: 0 }); return; }
    if (drag?.title !== title || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); setKeyPosition((current) => keyTo(current, event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", event.shiftKey));
  };
  return <div className="tour-arrival" data-testid="tour-act-one" onPointerMove={(event) => { if (drag && drag.pointerId >= 0) setDrag({ ...drag, x: event.clientX, y: event.clientY }); }} onPointerUp={finishPointer} onPointerCancel={() => setDrag(null)}>
    <TourWorkboard active="add" onAddWork={() => setFilesOpen(true)}><div data-testid="tour-drop-board" className="tour-shared-act"><TourBoard register={register} state={{ act: 1, landedFile: landed }} boardRef={boardRef}>
      <aside className="tour-arrival-hint">You can also drag files, documents or images straight from your computer onto the board.</aside>
      {filesOpen ? <div className="tour-file-window-layer"><FileWindow files={files} drag={drag} onPointerDown={(title, event) => { event.currentTarget.setPointerCapture?.(event.pointerId); if (event.pointerType === "touch") { land(title); return; } setDrag({ title, pointerId: event.pointerId, x: event.clientX, y: event.clientY }); }} onKeyDown={onFileKeyDown} /></div> : null}
    </TourBoard></div></TourWorkboard>
    {drag ? <div className="tour-file-drag" data-keyboard={drag.pointerId < 0} style={drag.pointerId < 0 ? { transform: `translate(${keyPosition.x}px, ${keyPosition.y}px)` } : { left: drag.x, top: drag.y }}><DrawnFileGlyph seed={drag.title} /><span>{drag.title}</span></div> : null}
  </div>;
}

function boxHandlers(boardRef: React.RefObject<HTMLDivElement | null>, box: Box | null, setBox: (box: Box | null) => void, startRef: React.MutableRefObject<{ x: number; y: number } | null, finish: (left: number, top: number, right: number, bottom: number) => void) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => { if ((event.target as HTMLElement).closest("[data-tour-card],button")) return; const rect = event.currentTarget.getBoundingClientRect(); startRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; setBox({ ...startRef.current, width: 0, height: 0 }); },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => { const start = startRef.current; if (!start) return; const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; setBox({ x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) }); },
    onPointerUp: () => { if (!box || !boardRef.current) { setBox(null); return; } const board = boardRef.current.getBoundingClientRect(); finish(board.left + box.x, board.top + box.y, board.left + box.x + box.width, board.top + box.y + box.height); setBox(null); startRef.current = null; },
    onPointerCancel: () => { setBox(null); startRef.current = null; },
  };
}

export function TourActTwo({ register, hint: _hint, onComplete }: { register: Register; hint: boolean; onComplete: () => void }) {
  const cards = TOUR_CONTENT[register].acts[1]?.cards ?? [];
  const [selected, setSelected] = useState<string[]>([]); const [box, setBox] = useState<Box | null>(null);
  const boardRef = useRef<HTMLDivElement>(null); const startRef = useRef<{ x: number; y: number } | null>(null); const completeRef = useRef(false);
  const finish = () => { if (!completeRef.current) { completeRef.current = true; setSelected([...GROUP_IDS]); onComplete(); } };
  const select = (index: number) => { if (cards[index]?.inSet) finish(); };
  const handlers = boxHandlers(boardRef, box, setBox, startRef, (left, top, right, bottom) => {
    const required = GROUP_IDS.map((id) => boardRef.current?.querySelector<HTMLElement>(`[data-tour-layout-id="${id}"]`)?.getBoundingClientRect()).filter((rect) => rect !== undefined);
    if (required.length === 3 && required.every((rect) => rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top)) finish();
  });
  return <TourWorkboard active="select"><div className="tour-shared-act" data-testid="tour-act-two"><TourBoard register={register} state={{ act: 2, outlinedIds: GROUP_IDS, selectedIds: selected }} boardRef={boardRef} {...handlers} onWorkCardSelect={select} onWorkCardKeyDown={(index, event) => { if (event.code === "Space") { event.preventDefault(); select(index); } }}>{box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}</TourBoard></div></TourWorkboard>;
}

export function TourActThree({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const act = TOUR_CONTENT[register].acts[2]; const [grouped, setGrouped] = useState(false); const [box, setBox] = useState<Box | null>(null);
  const boardRef = useRef<HTMLDivElement>(null); const startRef = useRef<{ x: number; y: number } | null>(null);
  const group = () => { if (grouped) return; setGrouped(true); onComplete(); };
  const handlers = boxHandlers(boardRef, box, setBox, startRef, (left, top, right, bottom) => {
    const required = GROUP_IDS.map((id) => boardRef.current?.querySelector<HTMLElement>(`[data-tour-layout-id="${id}"]`)?.getBoundingClientRect()).filter((rect) => rect !== undefined);
    if (required.length === 3 && required.every((rect) => left <= rect.left && top <= rect.top && right >= rect.right && bottom >= rect.bottom)) group();
  });
  return <TourWorkboard active="group" onGroup={group}><div className="tour-shared-act" data-testid="tour-act-three" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); group(); } }}><TourBoard register={register} state={{ act: 3, selectedIds: GROUP_IDS, groupedIds: grouped ? GROUP_IDS : [], glowingIds: grouped ? GROUP_IDS : [] }} boardRef={boardRef} {...handlers}>{box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}{grouped ? <p className="tour-context-sentence">{act?.contextSentence}</p> : null}</TourBoard></div></TourWorkboard>;
}

function TourAskMimic({ register, visibleClaims, generating, onAsk }: { register: Register; visibleClaims: number; generating: boolean; onAsk: () => void }) {
  const act = TOUR_CONTENT[register].acts[3]; const chatCard = (TOUR_CONTENT[register].acts[1]?.cards ?? []).find((card) => card.title === act?.chatLink?.cardTitle);
  return <aside className="tour-ask-mimic" aria-label="Ask Lasso tour example"><header><LassoLoopMark className={generating ? "tour-ask-loop is-generating" : "tour-ask-loop"} /><strong>Ask Lasso</strong></header><div className="tour-ask-question" aria-label="Preset question" aria-readonly="true">{act?.question}</div><div className="tour-ask-claims" aria-live="polite">
    {(act?.answer ?? []).slice(0, visibleClaims).map((claim) => <article key={claim.sourceCardTitle} className="tour-ask-claim"><p>{claim.text}</p><span>{claim.sourceCardTitle}</span></article>)}
    {visibleClaims === (act?.answer?.length ?? 0) && act?.chatLink && chatCard ? <Button type="button" variant="outline" className="tour-chat-link" onClick={noop} aria-label={`${act.chatLink.label}: ${act.chatLink.cardTitle}`}><ToolBadge tool={sourceTool(chatCard.source)} size="sm" /><span>{act.chatLink.label}</span><strong>{act.chatLink.cardTitle}</strong></Button> : null}
  </div><Button type="button" variant="ink" onClick={onAsk} disabled={generating || visibleClaims === 3}>Ask</Button></aside>;
}

export function TourActFour({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const claims = TOUR_CONTENT[register].acts[3]?.answer ?? []; const reduced = useReducedMotion();
  const [visibleClaims, setVisibleClaims] = useState(0); const [generating, setGenerating] = useState(false); const [askOpen, setAskOpen] = useState(false); const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const ask = () => { if (generating || visibleClaims === claims.length) return; setGenerating(true); if (reduced) { setVisibleClaims(claims.length); setGenerating(false); onComplete(); return; } claims.forEach((_, index) => { const timer = window.setTimeout(() => { setVisibleClaims(index + 1); if (index === claims.length - 1) { setGenerating(false); onComplete(); } }, 400 * (index + 1)); timers.current.push(timer); }); };
  const highlighted = visibleClaims > 0 ? claims[visibleClaims - 1]?.sourceCardTitle ?? null : null;
  return <TourWorkboard active="ask" onAsk={() => setAskOpen(true)}><div className="tour-shared-act" data-testid="tour-act-four"><TourBoard register={register} state={{ act: 4, selectedIds: GROUP_IDS, groupedIds: GROUP_IDS, glowingIds: GROUP_IDS, highlightedTitle: highlighted, askOpen }}>{askOpen ? <TourAskMimic register={register} visibleClaims={visibleClaims} generating={generating} onAsk={ask} /> : null}</TourBoard></div></TourWorkboard>;
}

export function TourActFive({ register, onLanded }: { register: Register; onLanded: () => void }) {
  const [landed, setLanded] = useState(false); const [dragging, setDragging] = useState(false); const boardRef = useRef<HTMLDivElement>(null);
  const land = () => { if (landed) return; setLanded(true); setDragging(false); onLanded(); };
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => { if (!dragging) return; const rect = boardRef.current?.getBoundingClientRect(); if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) land(); else setDragging(false); };
  return <TourWorkboard active={null}><div className="tour-shared-act" data-testid="tour-act-five"><TourBoard register={register} state={{ act: 5, selectedIds: GROUP_IDS, groupedIds: GROUP_IDS, glowingIds: GROUP_IDS, answerVisible: landed, connectorsVisible: landed }} boardRef={boardRef} onPointerUp={finishDrag} onPointerCancel={() => setDragging(false)}>
    {!landed ? <aside className="tour-keep-panel"><article className="tour-drag-answer" onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); setDragging(true); }}><span>Answer</span><p>{TOUR_CONTENT[register].acts[3]?.answer?.map((claim) => claim.text).join(" ")}</p></article><Button type="button" variant="ink" data-tour-target="5" onClick={land}>Keep</Button></aside> : null}
  </TourBoard></div></TourWorkboard>;
}

export function useTourActRenderers({ register, activeAct, onAdvance, onHintShown, onFinish }: { register: Register; activeAct: 1 | 2 | 3 | 4 | 5; onAdvance: (act: 1 | 2 | 3 | 4) => void; onHintShown: (act: number) => void; onFinish: () => void }) {
  const [hintAct, setHintAct] = useState<number | null>(null); const [instructionOverride, setInstructionOverride] = useState<string | null>(null); const [answerLanded, setAnswerLanded] = useState(false);
  useEffect(() => { setHintAct(null); setInstructionOverride(null); setAnswerLanded(false); }, [activeAct, register]);
  const hint = (act: number) => { setHintAct(act); onHintShown(act); };
  const renderers = useMemo(() => [
    { content: <TourActOne register={register} onComplete={() => onAdvance(1)} /> },
    { content: <TourActTwo register={register} hint={hintAct === 2} onComplete={() => onAdvance(2)} /> },
    { content: <TourActThree register={register} onComplete={() => onAdvance(3)} /> },
    { content: <TourActFour register={register} onComplete={() => onAdvance(4)} /> },
    { content: <TourActFive register={register} onLanded={() => { setAnswerLanded(true); setInstructionOverride(TOUR_CONTENT[register].acts[4]?.closingLine ?? null); }} />, primaryAction: answerLanded ? <Button type="button" variant="ink" onClick={onFinish}>{TOUR_CONTENT[register].acts[4]?.primaryActionLabel}</Button> : null },
  ], [answerLanded, hintAct, onAdvance, onFinish, register]);
  return { renderers, instructionOverride, hint };
}
