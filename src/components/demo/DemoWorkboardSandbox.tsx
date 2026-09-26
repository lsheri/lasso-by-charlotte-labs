import { Link } from "@tanstack/react-router";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabFrame as LabFrameElement } from "@/components/canvas-lab/LabFrame";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import { LabSticky, stickyBodyOf } from "@/components/canvas-lab/LabSticky";
import { buildSharedBoardModel } from "@/components/canvas-lab/SharedBoardView";
import { fitWorkboardViewport, type LabFrame, type LabLink, type LabNode, type LabResizeCorner, labInverseZoom, stageBounds } from "@/components/canvas-lab/canvas-lab-model";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { GraphiteIcon } from "@/components/notebook/icons";
import { PlaygroundProofCard, PlaygroundReplayAnswer } from "@/components/marketing/LandingBoard";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SharedBoardDto } from "@/lib/board-share-shared";
import { clampZoom, stepZoom, wheelPanVector, workboardPinchZoom, zoomAbout } from "@/lib/canvas-zoom";
import type { DemoPreset } from "@/lib/demo-presets-shared";
import { noteDemoOpened, noteDemoPlayInteracted, type DemoPlayAction } from "@/lib/demo-telemetry";
import { parseLandingProof, type LandingProof } from "@/lib/landing-proof-shared";
import type { WorkboardStickyBody } from "@/lib/canvas-lab-shared";

const noop = () => undefined;
type Point = { x: number; y: number };
type DragState = { kind: "node" | "frame"; id: string; from: Point; origins: Record<string, Point> };
type ResizeState = { id: string; corner: LabResizeCorner; from: Point; start: { x: number; y: number; width: number; height: number } };

function surface(): "desktop" | "phone" {
  return window.matchMedia("(max-width: 639px)").matches ? "phone" : "desktop";
}

function itemMap(board: SharedBoardDto) {
  return new Map(board.seed.work.map((item) => [item.id, item]));
}

function demoTitle(title: string): string {
  return title.replace(/\s*\(slide notes\)\s*/i, "").trim();
}

function fittedDemoView(viewport: HTMLDivElement | null, frames: LabFrame[], nodes: LabNode[]) {
  if (!viewport) return { zoom: 1, pan: { x: 0, y: 82 } };
  const toolbarClearance = 82;
  const readableFloor = 12 / 13.5;
  const fit = fitWorkboardViewport(
    { width: Math.max(320, viewport.clientWidth), height: Math.max(280, viewport.clientHeight - toolbarClearance) },
    frames,
    nodes,
    new Map(),
    null,
    48,
  );
  const zoom = Math.min(0.9, Math.max(readableFloor, fit.zoom));
  const bounds = fit.bounds;
  return {
    zoom,
    pan: {
      x: Math.max(48 - bounds.x * zoom, (viewport.clientWidth - bounds.width * zoom) / 2 - bounds.x * zoom),
      y: Math.max(48 - bounds.y * zoom, (viewport.clientHeight - toolbarClearance - bounds.height * zoom) / 2 - bounds.y * zoom) + toolbarClearance,
    },
  };
}

function finishedModel(board: SharedBoardDto): { frames: LabFrame[]; nodes: LabNode[]; links: LabLink[] } {
  const model = buildSharedBoardModel(board);
  const tasks = board.seed.tasks.filter((task) => !/board deck/i.test(task.name)).slice(0, 2);
  const frames = tasks.map((task, index): LabFrame => ({
    id: `task:${task.id}`,
    name: task.name,
    x: index === 0 ? 30 : 410,
    y: 110,
    width: 360,
    height: 726,
  }));
  const counts = new Map<string, number>();
  const nodes: LabNode[] = model.nodes.flatMap<LabNode>((node) => {
    if (node.kind !== "work" || !node.workItemId) return [];
    const item = board.seed.work.find((entry) => entry.id === node.workItemId);
    if (!item) return [];
    const deliverable = node.deliverable || /board deck/i.test(item.title);
    if (deliverable) return [{ ...node, id: `demo:${node.id}`, title: demoTitle(node.title), frame: null, x: 790, y: 130, width: 440, height: 486, deliverable: true }];
    const taskIndex = tasks.findIndex((task) => (item.placedIn ?? item.taskIds ?? []).includes(task.id));
    const picked = Math.max(0, taskIndex);
    const frame = frames[picked];
    if (!frame) return [];
    const slot = counts.get(frame.id) ?? 0;
    counts.set(frame.id, slot + 1);
    if (slot >= 3) return [];
    return [{ ...node, id: `demo:${node.id}`, frame: frame.id, x: frame.x + 20, y: frame.y + 58 + slot * 216, width: 320, height: 200 }];
  });
  const deck = nodes.find((node) => node.deliverable);
  const source = nodes.find((node) => !node.deliverable && /partnership|scenario/i.test(node.title)) ?? nodes.find((node) => !node.deliverable);
  const links: LabLink[] = source && deck ? [{ id: "demo-proof-link", fromId: source.id, toId: deck.id, fromAnchor: "right", toAnchor: "left" }] : [];
  const stickies: LabNode[] = [
    { id: "demo-open-1", kind: "sticky", frame: null, title: "Sticky", summary: "Confirm the vendor extension assumption.", typeLabel: "Sticky", ownership: "draft", local: true, stickyFill: "yellow", textSize: "body", textWeight: "regular", textColour: "ink", x: 790, y: 640, width: 206, height: 142 },
    { id: "demo-open-2", kind: "sticky", frame: null, title: "Sticky", summary: "Confirm approval by Oct 1.", typeLabel: "Sticky", ownership: "draft", local: true, stickyFill: "yellow", textSize: "body", textWeight: "regular", textColour: "ink", x: 1016, y: 640, width: 206, height: 142 },
  ];
  return { frames, nodes: [...nodes, ...stickies], links };
}

function DemoDeckSlide({ index, clientLabel }: { index: number; clientLabel: string }) {
  if (index === 0) return <div className="demo-deck-slide demo-deck-cover"><strong>FY27 growth partnerships</strong><span>{clientLabel}</span><i /></div>;
  if (index === 1) return <div className="demo-deck-slide demo-deck-scenarios"><strong>Three scenarios</strong><div><span>A<br />$0.3M</span><span data-picked="true">B<br />$1.4M</span><span>C<br />$1.2M</span></div></div>;
  if (index === 2) return <div className="demo-deck-slide demo-deck-waterfall"><strong>Year-two net benefit</strong><b>$1.4M</b><div><span><i />$2.1M savings</span><span><i />-$0.7M costs</span><span><i />$1.4M net</span></div></div>;
  if (index === 3) return <div className="demo-deck-slide demo-deck-structure"><strong>Board structure</strong><div><i /><i /><i /></div><span>Chair: two-term limit</span></div>;
  if (index === 4) return <div className="demo-deck-slide demo-deck-alliances"><strong>Comparable alliances</strong><div>{[1, 2, 3, 4, 5].map((item) => <i key={item} />)}</div></div>;
  return <div className="demo-deck-slide demo-deck-decision"><strong>Decision asked for Oct 1</strong><i /></div>;
}

function DemoDeliverable({ node, clientLabel, activeSlide, onSelectSlide, onPointerDown, onFocus }: { node: LabNode; clientLabel: string; activeSlide: number; onSelectSlide: (index: number) => void; onPointerDown: (event: ReactPointerEvent) => void; onFocus: () => void }) {
  return <article className="canvas-lab-card demo-deliverable-node absolute" data-testid={`lab-card-${node.id}`} data-node-id={node.id} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} tabIndex={0} onPointerDown={onPointerDown} onFocus={onFocus}>
    <header><GraphiteIcon name="example-board" /><span>Added Sep 24, 2026</span><strong>{node.title}</strong></header>
    <div className="demo-deliverable-main"><DemoDeckSlide index={activeSlide} clientLabel={clientLabel} /></div>
    <div className="demo-deliverable-thumbnails" aria-label="Deliverable slides">
      {Array.from({ length: 6 }, (_, index) => <button key={index} type="button" aria-label={`Show slide ${index + 1}`} aria-pressed={activeSlide === index} onPointerDown={(event) => event.stopPropagation()} onClick={() => onSelectSlide(index)}><span data-slide={index + 1} /></button>)}
    </div>
    <footer><span>PowerPoint</span><span>6 slides</span></footer>
  </article>;
}

function DemoSidebar({ clientLabel }: { clientLabel: string }) {
  return <aside className="demo-sandbox-sidebar" aria-label="Demo workspace navigation">
    <div className="demo-sandbox-brand"><LassoLoopMark /><span>LASSO</span></div>
    <div className="demo-sandbox-person"><span>YS</span><div><strong>YellowSigil</strong><small>Demo workspace</small></div></div>
    <nav><p>Your organization</p><span aria-label="Overview"><GraphiteIcon name="overview" /><b>Overview</b></span><span aria-label="Work"><GraphiteIcon name="work" /><b>Work</b></span><span data-current="true" aria-label="YSM-01"><GraphiteIcon name="engagement" /><b>YSM-01</b></span><p>Engagement</p><span aria-label="Workboard"><GraphiteIcon name="example-board" /><b>Workboard</b></span><span aria-label="Conversations"><GraphiteIcon name="messages" /><b>Conversations</b></span></nav>
    <div className="demo-sandbox-client">{clientLabel}</div>
  </aside>;
}

function DemoAskRail({ presets, proof, engagementTitle, open, onOpenChange, emit }: { presets: DemoPreset[]; proof: LandingProof | null; engagementTitle: string; open: boolean; onOpenChange: (open: boolean) => void; emit: (action: DemoPlayAction) => void }) {
  const [activePosition, setActivePosition] = useState(presets.find((entry) => entry.position === 1)?.position ?? presets[0]?.position ?? 1);
  const active = presets.find((entry) => entry.position === activePosition);
  const model = proof ? parseLandingProof(proof) : null;
  return <aside className="demo-sandbox-ask" data-open={open} aria-label="Ask Lasso" data-component="BoardAsk">
    <button type="button" className="demo-sandbox-ask-toggle" onClick={() => onOpenChange(!open)}><LassoThinkingMark kind="signature" size={34} /><span><b>Ask Lasso</b><small>{engagementTitle}</small></span></button>
    <div className="demo-sandbox-ask-body">
      <div className="demo-play-presets">{presets.map((preset) => <Button key={preset.position} size="sm" variant={preset.position === activePosition ? "secondary" : "outline"} onClick={() => { setActivePosition(preset.position); emit("preset_opened"); }}>{preset.question}</Button>)}</div>
      <div className="demo-play-answer">{active?.position === 1 && proof && model ? <PlaygroundProofCard proof={proof} model={model} emit={emit} /> : active ? <><div className="lb-replay-question"><span>You</span><p>{active.question}</p></div><PlaygroundReplayAnswer preset={active} /></> : <p>The saved answer is not available right now.</p>}</div>
      <div className="demo-play-composer"><Textarea disabled placeholder="Ask your own questions in a pilot" rows={2} /><Button disabled>Send</Button></div>
    </div>
  </aside>;
}

export function DemoWorkboardSandbox({ board, presets, proof, clientLabel, engagementTitle }: { board: SharedBoardDto; presets: DemoPreset[]; proof: LandingProof | null; clientLabel: string; engagementTitle: string }) {
  const initial = useMemo(() => finishedModel(board), [board]);
  const items = useMemo(() => itemMap(board), [board]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [frames, setFrames] = useState<LabFrame[]>(initial.frames);
  const [nodes, setNodes] = useState<LabNode[]>(initial.nodes);
  const [links] = useState(initial.links);
  const [view, setView] = useState({ zoom: 1, pan: { x: 0, y: 82 } });
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [askOpen, setAskOpen] = useState(true);
  const [hint, setHint] = useState(true);
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(5);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeSlide, setActiveSlide] = useState(2);
  const resetTimer = useRef<number | null>(null);
  const addedCounter = useRef(0);
  const panRef = useRef<{ from: Point; origin: Point } | null>(null);
  const touchRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const emit = useCallback((action: DemoPlayAction) => noteDemoPlayInteracted(action, surface()), []);
  const bounds = stageBounds(frames, nodes);
  const heightMap = useMemo(() => new Map(nodes.map((node) => [node.id, node.height])), [nodes]);

  useEffect(() => { noteDemoOpened("playground", "ysm-01"); if (surface() === "phone") setAskOpen(false); }, []);
  const clearTimer = useCallback(() => { if (resetTimer.current !== null) window.clearTimeout(resetTimer.current); resetTimer.current = null; }, []);
  const resetBoard = useCallback((automatic: boolean) => {
    clearTimer();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setResetting(!reduced); setFrames(initial.frames); setNodes(initial.nodes); setSelected(null); setActiveSlide(2); setResetAt(null); setRemaining(5);
    setView(fittedDemoView(viewportRef.current, initial.frames, initial.nodes));
    if (!reduced) window.setTimeout(() => setResetting(false), 600);
    emit(automatic ? "reset_auto" : "reset_manual");
  }, [clearTimer, emit, initial]);
  const scheduleReset = useCallback(() => {
    clearTimer();
    const at = Date.now() + 5_000; setResetAt(at); setRemaining(5);
    resetTimer.current = window.setTimeout(() => resetBoard(true), 5_000);
  }, [clearTimer, resetBoard]);
  useEffect(() => { if (!resetAt || drag || resize || editing) return; const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))), 200); return () => window.clearInterval(timer); }, [drag, editing, resetAt, resize]);
  useEffect(() => () => clearTimer(), [clearTimer]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const fit = () => setView(fittedDemoView(viewport, initial.frames, initial.nodes));
    fit();
    const observer = new ResizeObserver(fit); observer.observe(viewport); return () => observer.disconnect();
  }, []);

  const beginNodeDrag = (event: ReactPointerEvent, id: string) => {
    if ((event.target as HTMLElement).closest("button,textarea,input,select")) return;
    event.stopPropagation(); clearTimer(); setHint(false); setSelected(id);
    const node = nodes.find((entry) => entry.id === id); if (!node) return;
    setDrag({ kind: "node", id, from: { x: event.clientX, y: event.clientY }, origins: { [id]: { x: node.x, y: node.y } } });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const beginFrameDrag = (event: ReactPointerEvent, id: string) => {
    event.stopPropagation(); clearTimer(); setHint(false); setSelected(id);
    const frame = frames.find((entry) => entry.id === id); if (!frame) return;
    const origins = Object.fromEntries([frame, ...nodes.filter((node) => node.frame === id)].map((entry) => [entry.id, { x: entry.x, y: entry.y }]));
    setDrag({ kind: "frame", id, from: { x: event.clientX, y: event.clientY }, origins });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resize) {
      const dx = (event.clientX - resize.from.x) / view.zoom; const dy = (event.clientY - resize.from.y) / view.zoom;
      setNodes((current) => current.map((node) => node.id === resize.id ? { ...node, width: Math.max(180, resize.start.width + (resize.corner.includes("e") ? dx : -dx)), height: Math.max(100, resize.start.height + (resize.corner.includes("s") ? dy : -dy)), x: resize.corner.includes("w") ? resize.start.x + dx : node.x, y: resize.corner.includes("n") ? resize.start.y + dy : node.y } : node));
      return;
    }
    if (drag) {
      const dx = (event.clientX - drag.from.x) / view.zoom; const dy = (event.clientY - drag.from.y) / view.zoom;
      const moved = <T extends { id: string; x: number; y: number }>(entry: T): T => drag.origins[entry.id] ? { ...entry, x: (drag.origins[entry.id]?.x ?? entry.x) + dx, y: (drag.origins[entry.id]?.y ?? entry.y) + dy } : entry;
      setNodes((current) => current.map(moved)); if (drag.kind === "frame") setFrames((current) => current.map(moved)); return;
    }
    const point = { x: event.clientX, y: event.clientY }; touchRef.current.set(event.pointerId, point);
    if (touchRef.current.size >= 2) {
      const pair = [...touchRef.current.values()].slice(0, 2); const a = pair[0]; const b = pair[1]; if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y); const prior = pinchRef.current;
      if (!prior) { pinchRef.current = { distance, zoom: view.zoom }; return; }
      const rect = event.currentTarget.getBoundingClientRect(); const centre = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      const nextZoom = clampZoom(prior.zoom * distance / Math.max(1, prior.distance)); setView((current) => ({ zoom: nextZoom, pan: zoomAbout(current.pan, current.zoom, nextZoom, centre) })); return;
    }
    if (panRef.current) setView((current) => ({ ...current, pan: { x: panRef.current!.origin.x + event.clientX - panRef.current!.from.x, y: panRef.current!.origin.y + event.clientY - panRef.current!.from.y } }));
  };
  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    touchRef.current.delete(event.pointerId); if (touchRef.current.size < 2) pinchRef.current = null;
    if (resize) { setResize(null); emit("drag_card"); scheduleReset(); return; }
    if (drag) {
      if (drag.kind === "node") {
        const moved = nodes.find((node) => node.id === drag.id);
        const origin = drag.origins[drag.id];
        if (moved && origin && Math.hypot(moved.x - origin.x, moved.y - origin.y) > 72) setNodes((current) => current.map((node) => node.id === drag.id ? { ...node, frame: null } : node));
      }
      emit(drag.kind === "frame" ? "drag_group" : "drag_card"); setDrag(null); scheduleReset(); return;
    }
    panRef.current = null;
  };
  const addSticky = () => {
    addedCounter.current += 1; const id = `demo-added-${addedCounter.current}`;
    setNodes((current) => [...current, { id, kind: "sticky", frame: null, title: "Sticky", summary: "New note", typeLabel: "Sticky", ownership: "draft", local: true, stickyFill: "yellow", textSize: "body", textWeight: "regular", textColour: "ink", x: 760 + addedCounter.current * 18, y: 410 + addedCounter.current * 12, width: 180, height: 120 }]);
    setSelected(id); setHint(false); emit("sticky_added"); scheduleReset();
  };
  const changeSticky = (id: string, body: WorkboardStickyBody) => setNodes((current) => current.map((node) => node.id === id ? { ...node, summary: body.text.slice(0, 80), textSize: body.size, textWeight: body.weight, textColour: body.colour, stickyFill: body.fill } : node));
  const removeSticky = (id: string) => { setNodes((current) => current.filter((node) => node.id !== id)); scheduleReset(); };
  const beginResize = (node: LabNode, corner: LabResizeCorner, event: ReactPointerEvent<HTMLButtonElement>) => { event.stopPropagation(); clearTimer(); setResize({ id: node.id, corner, from: { x: event.clientX, y: event.clientY }, start: { x: node.x, y: node.y, width: node.width, height: node.height } }); event.currentTarget.setPointerCapture?.(event.pointerId); };
  const deck = nodes.find((node) => node.deliverable);

  return <div className="demo-workboard-shell" data-testid="canvas-lab-shell" data-resetting={resetting} data-interaction={drag ? "drag" : resize ? "resize" : "idle"} data-component="CanvasLabPage" onFocusCapture={(event) => { if ((event.target as HTMLElement).matches("textarea[aria-label='Sticky words']")) { clearTimer(); setEditing(true); } }} onBlurCapture={(event) => { if ((event.target as HTMLElement).matches("textarea[aria-label='Sticky words']")) { setEditing(false); scheduleReset(); } }}>
    <DemoSidebar clientLabel={clientLabel} />
    <div className="demo-workboard-main">
      <div className="demo-workboard-banner"><span>Demo workspace · every figure is invented · changes reset</span><nav><Link to="/" hash="lb-try-it">Back to the story</Link><Link to="/" hash="pilot">Book a pilot</Link></nav></div>
      <header className="demo-workboard-header"><div><p>YSM-01 · WORKBOARD</p><h1>{engagementTitle}</h1></div></header>
      <div className="demo-workboard-row">
        <section className="demo-workboard-board" aria-label="Workboard">
          <p className="demo-play-hint" data-visible={hint}>Drag anything. Add a sticky. It all goes back in 5 seconds.</p>
          <div className="demo-workboard-toolbar" aria-label="Board tools"><Button size="sm" variant="outline" onClick={addSticky}><GraphiteIcon name="sticky" />Add sticky</Button><Button size="sm" variant="outline" onClick={() => setAskOpen((open) => !open)}><GraphiteIcon name="ask-lasso" />Ask Lasso</Button><Button size="sm" variant="outline" onClick={() => resetBoard(false)}><GraphiteIcon name="history" />Reset</Button>{resetAt && !drag && !resize && !editing ? <span className="demo-reset-countdown"><i style={{ "--demo-reset-progress": `${remaining / 5}` } as CSSProperties} />Back to the finished board in {remaining}s</span> : null}</div>
          <div ref={viewportRef} className="canvas-lab-surface demo-sandbox-viewport" data-testid="canvas-lab-viewport" onPointerDown={(event) => { if (event.target !== event.currentTarget) return; touchRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); panRef.current = { from: { x: event.clientX, y: event.clientY }, origin: view.pan }; event.currentTarget.setPointerCapture?.(event.pointerId); }} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} onWheel={(event) => { event.preventDefault(); if (event.ctrlKey || event.metaKey) { const rect = event.currentTarget.getBoundingClientRect(); const next = workboardPinchZoom(view.zoom, event.deltaY, event.deltaMode); setView((current) => ({ zoom: next, pan: zoomAbout(current.pan, current.zoom, next, { x: event.clientX - rect.left, y: event.clientY - rect.top }) })); } else { const delta = wheelPanVector(event); setView((current) => ({ ...current, pan: { x: current.pan.x - delta.x, y: current.pan.y - delta.y } })); } }}>
            <div className="canvas-lab-stage demo-sandbox-stage" data-testid="canvas-lab-stage" style={{ width: Math.max(bounds.width, 1500), height: Math.max(bounds.height, 820), transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`, "--lab-inverse-zoom": labInverseZoom(view.zoom) } as CSSProperties}>
              {frames.map((frame) => <LabFrameElement key={frame.id} frame={frame} count={nodes.filter((node) => node.frame === frame.id).length} kind="task" selected={selected === frame.id} editable={false} custom={false} namedByWorkstream removable={false} onSelect={() => setSelected(frame.id)} onDragStart={(event) => beginFrameDrag(event, frame.id)} onResizeStart={noop} onFit={noop} onRename={noop} onRemove={noop} onMenuOpened={noop} onMenuOpenChange={noop} />)}
              <svg className="canvas-lab-relationships pointer-events-none absolute inset-0 overflow-visible" width={Math.max(bounds.width, 1500)} height={Math.max(bounds.height, 820)} aria-hidden="true"><LabRelationships links={links} nodes={nodes} measuredHeights={heightMap} selectedLinkId={null} inverseZoom={labInverseZoom(view.zoom)} onSelect={noop} /></svg>
              {nodes.filter((node) => node.kind === "sticky").map((node) => <LabSticky key={node.id} node={node} selected={selected === node.id} editable layoutEditable onSelect={() => setSelected(node.id)} onDragStart={(event) => beginNodeDrag(event, node.id)} onResizeStart={(corner, event) => beginResize(node, corner, event)} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={(body) => changeSticky(node.id, body)} onCommit={(body, field) => { changeSticky(node.id, body); if (field === "text") emit("sticky_edited"); setEditing(false); scheduleReset(); }} onRemove={() => removeSticky(node.id)} />)}
              {nodes.filter((node) => node.kind !== "sticky" && !node.deliverable).map((node) => {
                const sourceItem = node.workItemId ? items.get(node.workItemId) : undefined;
                const item = sourceItem && node.deliverable ? { ...sourceItem, title: demoTitle(sourceItem.title) } : sourceItem;
                return <LabCard key={node.id} node={node} item={item} preview={item ? board.cardPreviews[item.id] : undefined} filePreview={item ? board.filePreviews[item.id] : undefined} selected={selected === node.id} focused={selected === node.id} connecting={false} connectSourceAnchor={null} onSelect={() => setSelected(node.id)} onOpen={noop} onBranch={noop} onHide={noop} onDelete={noop} onEdit={noop} onEditCommitted={noop} onAnchorPointerDown={noop} onAnchorActivate={noop} onMenuOpened={noop} onMenuOpenChange={noop} onMeasure={noop} onPointerDown={(event) => beginNodeDrag(event, node.id)} onFocus={() => setSelected(node.id)} onKeyDown={noop} canResize onResizeStart={(corner, event) => beginResize(node, corner, event)} onFit={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} frameChoices={[]} structured={false} onMoveToFrame={noop} />;
              })}
              {deck ? <DemoDeliverable node={deck} clientLabel={clientLabel} activeSlide={activeSlide} onSelectSlide={(index) => { setActiveSlide(index); setHint(false); emit("slide_selected"); scheduleReset(); }} onPointerDown={(event) => beginNodeDrag(event, deck.id)} onFocus={() => setSelected(deck.id)} /> : null}
            </div>
          </div>
          <div className="demo-workboard-zoom" aria-label="Zoom controls"><Button size="icon" variant="outline" aria-label="Zoom out" onClick={() => { setHint(false); setView((current) => ({ ...current, zoom: stepZoom(current.zoom, "out") })); }}><GraphiteIcon name="minus" /></Button><span>{Math.round(view.zoom * 100)}%</span><Button size="icon" variant="outline" aria-label="Zoom in" onClick={() => { setHint(false); setView((current) => ({ ...current, zoom: stepZoom(current.zoom, "in") })); }}><GraphiteIcon name="plus" /></Button><Button size="icon" variant="outline" aria-label="Fit board" onClick={() => { setHint(false); setView(fittedDemoView(viewportRef.current, frames, nodes)); }}><GraphiteIcon name="fit" /></Button></div>
        </section>
        <DemoAskRail presets={presets} proof={proof} engagementTitle={engagementTitle} open={askOpen} onOpenChange={setAskOpen} emit={emit} />
      </div>
    </div>
  </div>;
}
