import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";

import { TourBoard } from "@/components/tour/TourBoard";
import { WorkboardHeader, WorkboardSideRail, WorkboardToolbar } from "@/components/canvas-lab/WorkboardChrome";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { GraphiteIcon } from "@/components/notebook/icons";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { ASK_SCOPE_ALL_LABEL, ASK_SCOPE_ONE_LABEL, askScopeWorkstreamLabel } from "@/components/reflect/AskSurface";
import { ToolBadge } from "@/components/onboarding/ToolBadge";
import { Button } from "@/components/ui/button";
import { WorkNote } from "@/components/work/WorkNote";
import { useReducedMotion as useMotionPreference } from "@/hooks/use-motion";
import { keyTo } from "@/lib/canvas-drag";
import type { ToolId } from "@/lib/onboarding-tools";
import type { Register } from "@/lib/register";
import { TOUR_BOARD_LAYOUT, actById, tourAmbientCards, tourBoardCopy, type TourActId, type TourPushedChat, type TourSource } from "@/lib/tour-content";
import type { WorkboardCardPreview } from "@/lib/workboard-card-preview.shared";
import type { WorkItemRow } from "@/lib/work-types";
import type { TourActRenderer } from "@/components/tour/TourStage";
import { useTourTeachBeat } from "@/components/tour/tour-beat";

const noop = () => undefined;
type DragFile = { title: string; pointerId: number; x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
export const GROUP_IDS = ["primary-0", "primary-1", "primary-2"] as const;

function sourceTool(source: TourSource): ToolId {
  if (source === "drive") return "googledrive";
  if (source === "email") return "gmail";
  return source;
}

function BringInWindow({ item, drag, onPointerDown, onKeyDown }: {
  item: { title: string; source: TourSource };
  drag: DragFile | null;
  onPointerDown: (title: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (title: string, event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return <section className="tour-file-window" aria-label="AI conversation to bring in"><header><i aria-hidden /><strong>AI conversation</strong></header><div>
    <Button type="button" variant="ghost" className="tour-file-row" data-tour-target="3" data-lifted={drag?.title === item.title} onPointerDown={(event) => onPointerDown(item.title, event)} onKeyDown={(event) => onKeyDown(item.title, event)}><ToolBadge tool={sourceTool(item.source)} size="sm" /><span>{item.title}</span></Button>
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
    <Button type="button" size="sm" variant="outline" aria-label="Add work" data-toolbar-control="add-work" data-tour-target={active === "add" ? "3" : undefined} className={toolClass("add")} onClick={active === "add" ? onAddWork : noop}><GraphiteIcon name="work" size={20} /><span>Add work</span></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Select work" aria-pressed={active === "select"} className={toolClass("select")} onClick={noop}><GraphiteIcon name="connectors" size={20} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Add grouping" aria-pressed={active === "group"} data-tour-target={active === "group" ? "5" : undefined} className={toolClass("group")} onClick={active === "group" ? onGroup : noop}><GraphiteIcon name="grouping" size={20} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Ask Lasso" aria-pressed={active === "ask"} data-tour-target={active === "ask" ? "6" : undefined} className={toolClass("ask")} onClick={active === "ask" ? onAsk : noop}><LassoThinkingMark kind="signature" size={24} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Info" onClick={noop}><GraphiteIcon name="working-from" size={20} /></Button>
    <Button type="button" size="icon" variant="outline" aria-label="Fit" onClick={noop}><GraphiteIcon name="fit" size={20} /></Button>
  </WorkboardToolbar>;
  return <div className="tour-workboard-chrome"><WorkboardSideRail menuControl={<Button type="button" size="icon" variant="ghost" aria-label="Open workboard menu" onClick={noop}><GraphiteIcon name="more" size={18} /></Button>} closeControl={<Button type="button" size="icon" variant="ghost" aria-label="Close workboard" onClick={noop}><GraphiteIcon name="close" size={18} /></Button>} /><div className="tour-workboard-main"><WorkboardHeader title="Your workboard" status="WORKBOARD" toolbar={toolbar} /><div className="tour-workboard-canvas">{children}</div></div></div>;
}

export function TourActOne({ register, onComplete }: { register: Register; onComplete: (title: string) => void }) {
  const bringIn = actById(register, 3)?.bringIn;
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragFile | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [keyPosition, setKeyPosition] = useState({ x: 0, y: 0 });
  const land = (title: string) => { if (landed) return; setLanded(title); setFilesOpen(false); onComplete(title); };
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const board = (event.currentTarget.querySelector('[data-testid="tour-drop-board"]') ?? boardRef.current)?.getBoundingClientRect();
    const inside = Boolean(board && event.clientX >= board.left && event.clientX <= board.right && event.clientY >= board.top && event.clientY <= board.bottom);
    if (event.pointerType === "touch" || inside) land(drag.title);
    setDrag(null); setKeyPosition({ x: 0, y: 0 });
  };
  const onFileKeyDown = (title: string, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.code === "Space") { event.preventDefault(); if (drag?.title === title) { land(title); setDrag(null); } else setDrag({ title, pointerId: -1, x: 0, y: 0 }); return; }
    if (drag?.title !== title || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); setKeyPosition((current) => keyTo(current, event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", event.shiftKey));
  };
  return <div className="tour-arrival" data-testid="tour-act-one" onPointerMove={(event) => { if (drag && drag.pointerId >= 0) setDrag({ ...drag, x: event.clientX, y: event.clientY }); }} onPointerUp={finishPointer} onPointerCancel={() => setDrag(null)}>
    <TourWorkboard active={!landed && !filesOpen ? "add" : null} onAddWork={() => setFilesOpen(true)}><div data-testid="tour-drop-board" className="tour-shared-act"><TourBoard register={register} state={{ act: 3, landedFile: landed }} boardRef={boardRef}>
      <aside className="tour-arrival-hint">You can also drag files, documents or images straight from your computer onto the board.</aside>
      {filesOpen && bringIn ? <div className="tour-file-window-layer"><BringInWindow item={bringIn} drag={drag} onPointerDown={(title, event) => { event.currentTarget.setPointerCapture?.(event.pointerId); if (event.pointerType === "touch") { land(title); return; } setDrag({ title, pointerId: event.pointerId, x: event.clientX, y: event.clientY }); }} onKeyDown={onFileKeyDown} /></div> : null}
    </TourBoard></div></TourWorkboard>
    {drag && bringIn ? <div className="tour-file-drag" data-keyboard={drag.pointerId < 0} style={drag.pointerId < 0 ? { transform: `translate(${keyPosition.x}px, ${keyPosition.y}px)` } : { left: drag.x, top: drag.y }}><ToolBadge tool={sourceTool(bringIn.source)} size="sm" /><span>{drag.title}</span></div> : null}
  </div>;
}

function boxHandlers(boardRef: RefObject<HTMLDivElement | null>, box: Box | null, setBox: (box: Box | null) => void, startRef: MutableRefObject<{ x: number; y: number } | null>, finish: (left: number, top: number, right: number, bottom: number) => void) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => { if ((event.target as HTMLElement).closest("[data-tour-card],button")) return; const rect = event.currentTarget.getBoundingClientRect(); startRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; setBox({ ...startRef.current, width: 0, height: 0 }); },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => { const start = startRef.current; if (!start) return; const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; setBox({ x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) }); },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => { const start = startRef.current; if (!start || !boardRef.current) { setBox(null); return; } const board = boardRef.current.getBoundingClientRect(); const x = event.clientX - board.left; const y = event.clientY - board.top; finish(board.left + Math.min(start.x, x), board.top + Math.min(start.y, y), board.left + Math.max(start.x, x), board.top + Math.max(start.y, y)); setBox(null); startRef.current = null; },
    onPointerCancel: () => { setBox(null); startRef.current = null; },
  };
}

export function TourActTwo({ register, hint: _hint, onComplete }: { register: Register; hint: boolean; onComplete: () => void }) {
  const cards = actById(register, 4)?.cards ?? [];
  const [selected, setSelected] = useState<string[]>([]); const [box, setBox] = useState<Box | null>(null);
  const boardRef = useRef<HTMLDivElement>(null); const startRef = useRef<{ x: number; y: number } | null>(null); const completeRef = useRef(false);
  const finish = () => { if (!completeRef.current) { completeRef.current = true; setSelected([...GROUP_IDS]); onComplete(); } };
  const select = (index: number) => { if (cards[index]?.inSet) finish(); };
  const handlers = boxHandlers(boardRef, box, setBox, startRef, (left, top, right, bottom) => {
    const required = GROUP_IDS.map((id) => boardRef.current?.querySelector<HTMLElement>(`[data-tour-layout-id="${id}"]`)?.getBoundingClientRect()).filter((rect) => rect !== undefined);
    if (required.length === 3 && required.every((rect) => rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top)) finish();
  });
  return <TourWorkboard active="select"><div className="tour-shared-act" data-testid="tour-act-two" {...handlers}><TourBoard register={register} state={{ act: 4, outlinedIds: GROUP_IDS, selectedIds: selected }} className="tour-board-act" boardRef={boardRef} onWorkCardSelect={select} onWorkCardKeyDown={(index, event) => { if (event.code === "Space") { event.preventDefault(); select(index); } }}>{box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}</TourBoard></div></TourWorkboard>;
}

export function TourActThree({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const act = actById(register, 5); const [grouped, setGrouped] = useState(false); const [box, setBox] = useState<Box | null>(null);
  const boardRef = useRef<HTMLDivElement>(null); const startRef = useRef<{ x: number; y: number } | null>(null);
  const group = () => { if (grouped) return; setGrouped(true); onComplete(); };
  const handlers = boxHandlers(boardRef, box, setBox, startRef, (left, top, right, bottom) => {
    const required = GROUP_IDS.map((id) => boardRef.current?.querySelector<HTMLElement>(`[data-tour-layout-id="${id}"]`)?.getBoundingClientRect()).filter((rect) => rect !== undefined);
    if (required.length === 3 && required.every((rect) => left <= rect.left && top <= rect.top && right >= rect.right && bottom >= rect.bottom)) group();
  });
  return <TourWorkboard active={grouped ? null : "group"} onGroup={group}><div className="tour-shared-act" data-testid="tour-act-three" {...handlers} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); group(); } }}><TourBoard register={register} state={{ act: 5, selectedIds: GROUP_IDS, groupedIds: grouped ? GROUP_IDS : [], glowingIds: grouped ? GROUP_IDS : [] }} className="tour-board-act" boardRef={boardRef}>{box ? <span className="tour-marquee" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} /> : null}{grouped ? <p className="tour-context-sentence">{act?.contextSentence}</p> : null}</TourBoard></div></TourWorkboard>;
}

function TourAskMimic({ register, visibleClaims, generating, onAsk }: { register: Register; visibleClaims: number; generating: boolean; onAsk: () => void }) {
  const act = actById(register, 6); const chatCard = (actById(register, 4)?.cards ?? []).find((card) => card.title === act?.chatLink?.cardTitle);
  const activeScope = askScopeWorkstreamLabel(actById(register, 5)?.frameTitle ?? "Workstream");
  return <aside className="tour-ask-mimic" aria-label="Ask Lasso tour example"><header><LassoLoopMark className={generating ? "tour-ask-loop is-generating" : "tour-ask-loop"} /><strong>Ask Lasso</strong></header><div className="tour-ask-scopes" aria-label="Question scope"><span className="tour-ask-scope is-active" aria-current="true">{activeScope}</span><Button type="button" variant="outline" size="sm" className="tour-ask-scope" aria-pressed="false" onClick={noop}>{ASK_SCOPE_ONE_LABEL}</Button><Button type="button" variant="outline" size="sm" className="tour-ask-scope" aria-pressed="false" onClick={noop}>{ASK_SCOPE_ALL_LABEL}</Button></div><div className="tour-ask-question" aria-label="Preset question" aria-readonly="true">{act?.question}</div><div className="tour-ask-claims" aria-live="polite">
    {(act?.answer ?? []).slice(0, visibleClaims).map((claim) => <article key={claim.sourceCardTitle} className="tour-ask-claim"><p>{claim.text}</p><span>{claim.sourceCardTitle}</span></article>)}
    {visibleClaims === (act?.answer?.length ?? 0) && act?.chatLink && chatCard ? <Button type="button" variant="outline" className="tour-chat-link" onClick={noop} aria-label={`${act.chatLink.label}: ${act.chatLink.cardTitle}`}><ToolBadge tool={sourceTool(chatCard.source)} size="sm" /><span>{act.chatLink.label}</span><strong>{act.chatLink.cardTitle}</strong></Button> : null}
  </div><Button type="button" variant="ink" data-tour-target={visibleClaims < 3 ? "6" : undefined} onClick={onAsk} disabled={generating || visibleClaims === 3}>Ask</Button></aside>;
}

export function TourActFour({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const claims = actById(register, 6)?.answer ?? []; const reduced = useReducedMotion();
  const [visibleClaims, setVisibleClaims] = useState(0); const [generating, setGenerating] = useState(false); const [askOpen, setAskOpen] = useState(false); const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const ask = () => { if (generating || visibleClaims === claims.length) return; setGenerating(true); if (reduced) { setVisibleClaims(claims.length); setGenerating(false); onComplete(); return; } claims.forEach((_, index) => { const timer = window.setTimeout(() => { setVisibleClaims(index + 1); if (index === claims.length - 1) { setGenerating(false); onComplete(); } }, 400 * (index + 1)); timers.current.push(timer); }); };
  const highlighted = visibleClaims > 0 ? claims[visibleClaims - 1]?.sourceCardTitle ?? null : null;
  return <TourWorkboard active={askOpen ? null : "ask"} onAsk={() => setAskOpen(true)}><div className="tour-shared-act" data-testid="tour-act-four"><TourBoard register={register} state={{ act: 6, selectedIds: GROUP_IDS, groupedIds: GROUP_IDS, glowingIds: GROUP_IDS, highlightedTitle: highlighted, askOpen }}>{askOpen ? <TourAskMimic register={register} visibleClaims={visibleClaims} generating={generating} onAsk={ask} /> : null}</TourBoard></div></TourWorkboard>;
}

export function TourActFive({ register, onLanded }: { register: Register; onLanded: () => void }) {
  const reducedMotion = useMotionPreference();
  const [landed, setLanded] = useState(false); const [dragging, setDragging] = useState(false); const boardRef = useRef<HTMLDivElement>(null);
  const land = () => { if (landed) return; setLanded(true); setDragging(false); onLanded(); };
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => { if (!dragging) return; const rect = boardRef.current?.getBoundingClientRect(); if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) land(); else setDragging(false); };
  return <TourWorkboard active={null}><div className="tour-shared-act" data-testid="tour-act-five"><TourBoard register={register} state={{ act: 7, selectedIds: GROUP_IDS, groupedIds: GROUP_IDS, glowingIds: GROUP_IDS, answerVisible: landed, connectorsVisible: landed, reducedMotion }} boardRef={boardRef} onPointerUp={finishDrag} onPointerCancel={() => setDragging(false)}>
    {!landed ? <aside className="tour-keep-panel"><article className="tour-drag-answer" onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); setDragging(true); }}><span>Answer</span><p>{actById(register, 6)?.answer?.map((claim) => claim.text).join(" ")}</p></article><Button type="button" variant="ink" data-tour-target="7" onClick={land}>Keep</Button></aside> : null}
  </TourBoard></div></TourWorkboard>;
}

function TourDeckSlide({ register, reducedMotion }: { register: Register; reducedMotion: boolean }) {
  const boardCopy = tourBoardCopy(register);
  const claims = actById(register, 6)?.answer ?? [];
  const cards = actById(register, 4)?.cards ?? [];
  const deliverable = actById(register, 8)?.deliverable;
  const layout = TOUR_BOARD_LAYOUT.find((item) => item.id === "deliverable");
  const layoutStyle = layout ? { left: `${layout.x}%`, top: `${layout.y}%`, width: `${layout.widthBasis}%`, transform: `rotate(${layout.rotation}deg)` } : undefined;
  return <aside className="tour-deck-overlay" data-tour-layout-id="deliverable" data-tour-title={boardCopy.deckTitle} data-testid="tour-deck-slide" data-reduced={reducedMotion ? "" : undefined} aria-label={boardCopy.deckTitle} style={layoutStyle}>
    <div className="tour-deck-thumbnails" aria-label="Slide thumbnails"><span /><span /><span data-active="true">12</span></div>
    <section data-page={12} className="tour-deck-page-wrap">
      <p className="micro-label micro-label-field">Slide 12</p>
      <div className="tour-deck-page relative w-full overflow-hidden rounded-[var(--radius)] border border-border bg-white">
        <header><span>{boardCopy.owner}</span><strong>{boardCopy.deckTitle}</strong></header>
        <h2>Fall launch recommendation</h2>
        <div className="tour-deck-body">
          <ol>
            {claims.map((claim) => {
              const source = cards.find((card) => card.title === claim.sourceCardTitle)?.source;
              return <li key={claim.sourceCardTitle} data-source-title={claim.sourceCardTitle}>{source ? <ToolBadge tool={sourceTool(source)} size="sm" /> : null}<span>{claim.text}</span></li>;
            })}
          </ol>
          <svg className="tour-deck-chart" viewBox="0 0 84 54" role="img" aria-label="Decorative four bar chart" data-testid="tour-deck-chart">
            <path d="M8 5v41h70" />
            <rect x="16" y="30" width="10" height="16" />
            <rect x="31" y="20" width="10" height="26" />
            <rect x="46" y="12" width="10" height="34" />
            <rect x="61" y="25" width="10" height="21" />
          </svg>
        </div>
        <span className="tour-deck-slide-number">12</span>
      </div>
    </section>
    <p className="tour-deck-caption">{deliverable?.caption}</p>
  </aside>;
}

export function TourActSix({ register }: { register: Register }) {
  const reducedMotion = useMotionPreference();
  return <TourWorkboard active={null}><div className="tour-shared-act" data-testid="tour-act-six"><TourBoard register={register} state={{ act: 8, selectedIds: GROUP_IDS, groupedIds: GROUP_IDS, glowingIds: GROUP_IDS, answerVisible: true, connectorsVisible: true, reducedMotion }}>
    <TourDeckSlide register={register} reducedMotion={reducedMotion} />
  </TourBoard></div></TourWorkboard>;
}

export const TOUR_TURN_DELAY_MS = 900;

function TourPushChat({ chat, shown, reduced, pushed, onPush }: { chat: TourPushedChat; shown: number; reduced: boolean; pushed: boolean; onPush: () => void }) {
  const ready = shown >= chat.turns.length + 2;
  return <section className={`tour-chat-window${ready ? " is-ready" : ""}`} aria-label={`AI chat: ${chat.title}`} data-reduced={reduced ? "" : undefined}>
    <header><ToolBadge tool={chat.source} size="sm" /><strong>{chat.title}</strong></header>
    <ol className="tour-chat-turns">
      {chat.turns.slice(0, Math.min(shown, chat.turns.length)).map((turn, index) => <li key={index} className="tour-chat-turn" data-role={turn.role}>{turn.text}</li>)}
      {shown > chat.turns.length ? <li className="tour-chat-turn is-push-line" data-role="user">{chat.pushLine}</li> : null}
    </ol>
    <footer>{ready ? <Button type="button" variant="ink" className="tour-push-control" data-tour-target={!pushed ? "1" : undefined} data-pushed={pushed ? "" : undefined} onClick={onPush}>{pushed ? chat.pushedLabel : chat.pushLabel}</Button> : null}</footer>
  </section>;
}

export function TourActPush({ register, onReady }: { register: Register; onReady: () => void }) {
  const act = actById(register, 1);
  const chats = [act?.chat, act?.companionChat].filter((chat): chat is TourPushedChat => chat !== undefined);
  const reduced = useMotionPreference();
  const teaching = useTourTeachBeat();
  const total = Math.max(...chats.map((chat) => chat.turns.length + 2), 0);
  const [step, setStep] = useState(0);
  const [pushed, setPushed] = useState<Set<string>>(() => new Set());
  const shown = reduced ? total : step;
  useEffect(() => {
    // The shared timer starts only once the teach beat is dismissed.
    if (reduced || teaching) return;
    const timers = Array.from({ length: total }, (_, index) => window.setTimeout(() => setStep(index + 1), TOUR_TURN_DELAY_MS * (index + 1)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduced, teaching, total]);
  const push = (title: string) => {
    if (pushed.has(title)) return;
    const next = new Set(pushed).add(title);
    setPushed(next);
    if (next.size === chats.length) onReady();
  };
  if (chats.length !== 2) return null;
  return <div className="tour-push-stage tour-push-pair" data-testid="tour-act-push">
    {chats.map((chat) => <TourPushChat key={chat.title} chat={chat} shown={shown} reduced={reduced} pushed={pushed.has(chat.title)} onPush={() => push(chat.title)} />)}
  </div>;
}

const TOUR_CHAT_DATE = "2026-10-05T12:00:00.000Z";
const TOUR_TOOL_FILTERS = ["Everything", "Claude", "ChatGPT", "Gemini"] as const;

function tourChatItem(id: string, title: string, source: "claude" | "chatgpt" | "gemini"): WorkItemRow {
  return {
    id,
    title,
    type: "ai_thread",
    source,
    source_vendor: source,
    visibility: "mapped",
    captured_at: TOUR_CHAT_DATE,
    content_ref: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    work_item_extracts: [],
  };
}

function tourChatPreview(id: string, excerpt: string): WorkboardCardPreview {
  return {
    workItemId: id,
    summary: excerpt,
    turns: [{ turnNo: 1, role: "user", content: excerpt }],
    firstUserTurn: { turnNo: 1, role: "user", content: excerpt },
    turnCount: 8,
    toolSteps: 0,
    model: null,
  };
}

export function TourActArrived({ register, onComplete }: { register: Register; onComplete: () => void }) {
  const list = actById(register, 2)?.conversations;
  const actOne = actById(register, 1);
  const chats = [actOne?.chat, actOne?.companionChat].filter((chat): chat is TourPushedChat => chat !== undefined);
  const completeRef = useRef(false);
  if (!list || chats.length !== 2) return null;
  const rows = [
    ...chats.map((chat, index) => ({ item: tourChatItem(`tour-arrived-${index}`, chat.title, chat.source), preview: tourChatPreview(`tour-arrived-${index}`, chat.turns[0]?.text ?? "Fall launch conversation."), arrived: true })),
    ...tourAmbientCards(register).map((card, index) => ({ item: tourChatItem(`tour-ambient-${index}`, card.title, card.source), preview: tourChatPreview(`tour-ambient-${index}`, card.excerpt[0]), arrived: false })),
  ];
  const arrivedCount = rows.filter((row) => row.arrived).length;
  const boardTitle = tourBoardCopy(register).title;
  const openWorkboard = () => {
    if (completeRef.current) return;
    completeRef.current = true;
    onComplete();
  };
  return <div className="tour-push-stage" data-testid="tour-act-arrived">
    <section className="tour-conversations-mimic nb-chatview" data-reader="closed" aria-label="All AI Conversations tour example">
      <aside className="tour-conversations-sidebar" aria-label="Tour navigation">
        <nav className="flex flex-col gap-7">
          <div><div className="nb-group-header px-2">What landed</div><div className="mt-2 flex flex-col gap-0.5">
            <Button type="button" variant="ghost" className="nb-nav-item w-full justify-start" onClick={noop}><GraphiteIcon name="overview" size={20} /><span>Home</span></Button>
            <Button type="button" variant="ghost" className="nb-nav-item w-full justify-start" onClick={noop}><GraphiteIcon name="work" size={20} /><span>Inbox</span></Button>
            <Button type="button" variant="ghost" className="nb-nav-item nb-nav-item-active w-full justify-start" onClick={noop}><GraphiteIcon name="ai-record" size={20} /><span>All AI Conversations</span></Button>
          </div></div>
          <div><div className="nb-group-header px-2">Where it goes</div><div className="mt-2 flex flex-col gap-0.5">
            <Button type="button" variant="ghost" className="tour-workboard-nav-row nb-nav-item nb-nav-item-nested w-full justify-start" data-tour-target="2" onClick={openWorkboard}><GraphiteIcon name="workboard" size={20} /><span>{boardTitle}</span></Button>
            <Button type="button" variant="ghost" className="nb-nav-item w-full justify-start" onClick={noop}><GraphiteIcon name="plus" size={20} /><span>New workboard</span></Button>
          </div></div>
        </nav>
      </aside>
      <div className="nb-chatview-list flex min-h-0 flex-col overflow-hidden">
        <header className="box-border flex h-16 shrink-0 items-center gap-2 border-b border-[var(--nb-rule)] px-5">
          <div className="mr-auto min-w-0">
            <h1 className="truncate font-serif text-[19px] leading-none">{list.heading}</h1>
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{rows.length} conversations on the record · {arrivedCount} new this week</p>
          </div>
          <Button type="button" variant="outline" className="h-9" onClick={noop}>Add a chat</Button>
          <Button type="button" variant="outline" className="h-9" onClick={noop}><span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border-2 border-[var(--nb-lasso-green)]" />Ask Lasso</Button>
        </header>
        <div className="tour-conversations-toolbar flex h-[46px] shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--nb-rule)] px-5 whitespace-nowrap">
          <label htmlFor="tour-chat-library-search" className="sr-only">Search your chats</label>
          <input id="tour-chat-library-search" type="search" readOnly placeholder="Search your chats" className="h-7 w-[200px] shrink-0 rounded-[var(--radius)] border border-border bg-card px-3 nb-type-small text-foreground placeholder:text-muted-foreground" />
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--nb-rule)]" />
          <div role="group" aria-label="Filter by tool" className="flex shrink-0 items-center gap-2">
            {TOUR_TOOL_FILTERS.map((option, index) => <button key={option} type="button" aria-pressed={index === 0} onClick={noop} className={index === 0 ? "rounded-full border border-graphite bg-nb-white px-3 py-1 nb-type-small font-medium text-foreground" : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 nb-type-small text-muted-foreground"}>{option}<span className="ml-1.5 font-mono text-[10px] text-soft">{index === 0 ? rows.length : rows.filter((row) => row.item.source === option.toLowerCase()).length}</span></button>)}
          </div>
          <Button type="button" variant="outline" className="h-7 rounded-full" onClick={noop}>Workboards</Button>
          <div className="ml-auto flex shrink-0 items-center gap-2"><Button type="button" variant="ghost" className="h-7 text-[13px] text-muted-foreground" onClick={noop}>{rows.length} conversations.</Button></div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="conversation-month-stack p-5" aria-label="AI conversations by month">
            <section data-conversation-month="2026-10">
              <div className="flex min-h-10 items-center gap-3"><h2 className="font-hand text-[19px] leading-none text-graphite">October</h2><span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{rows.length}</span><span className="h-px flex-1 bg-[var(--nb-rule)]" /></div>
              <ul className="conversation-month-grid" aria-label="AI conversations">
                {rows.map((row) => <li key={row.item.id} className={row.arrived ? "tour-conversation-row is-arrived" : "tour-conversation-row"}>
                  {row.arrived ? <Button type="button" variant="ghost" className="conversation-card-compact canvas-lab-card-paper block h-full w-full min-w-0 p-0 text-left whitespace-normal hover:bg-transparent" onClick={noop}>
                    <WorkNote item={row.item} dense displayMode="preview" chatPreview={row.preview} lead={<span className="tour-arrived-label">{list.arrivedLabel}</span>} />
                  </Button> : <span className="conversation-card-compact canvas-lab-card-paper block h-full min-w-0"><WorkNote item={row.item} dense displayMode="preview" chatPreview={row.preview} /></span>}
                </li>)}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  </div>;
}

export function useTourActRenderers({ register, activeAct, onAdvance, onHintShown, onFinish }: { register: Register; activeAct: TourActId; onAdvance: (act: TourActId) => void; onHintShown: (act: number) => void; onFinish: () => void }) {
  const [hintAct, setHintAct] = useState<number | null>(null); const [instructionOverride, setInstructionOverride] = useState<string | null>(null); const [answerLanded, setAnswerLanded] = useState(false); const [actOneReady, setActOneReady] = useState(false);
  useEffect(() => { setHintAct(null); setInstructionOverride(null); setAnswerLanded(false); setActOneReady(false); }, [activeAct, register]);
  const hint = (act: number) => { setHintAct(act); onHintShown(act); };
  const renderers = useMemo((): TourActRenderer[] => [
    { id: 1, content: <TourActPush register={register} onReady={() => setActOneReady(true)} />, primaryAction: actOneReady ? <Button type="button" variant="ink" data-tour-target="1" onClick={() => onAdvance(1)}>Next</Button> : null },
    { id: 2, content: <TourActArrived register={register} onComplete={() => onAdvance(2)} /> },
    { id: 3, content: <TourActOne register={register} onComplete={() => onAdvance(3)} /> },
    { id: 4, content: <TourActTwo register={register} hint={hintAct === 4} onComplete={() => onAdvance(4)} /> },
    { id: 5, content: <TourActThree register={register} onComplete={() => onAdvance(5)} /> },
    { id: 6, content: <TourActFour register={register} onComplete={() => onAdvance(6)} /> },
    { id: 7, content: <TourActFive register={register} onLanded={() => setAnswerLanded(true)} />, primaryAction: answerLanded ? <Button type="button" variant="ink" data-tour-target="7" onClick={() => onAdvance(7)}>{actById(register, 7)?.primaryActionLabel}</Button> : null },
    { id: 8, content: <TourActSix register={register} />, primaryAction: <Button type="button" variant="ink" data-tour-target="8" onClick={onFinish}>{actById(register, 8)?.primaryActionLabel}</Button> },
  ], [actOneReady, answerLanded, hintAct, onAdvance, onFinish, register]);
  return { renderers, instructionOverride: activeAct === 8 ? actById(register, 8)?.closingLine ?? null : instructionOverride, hint };
}
