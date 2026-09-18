import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Menu, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CanvasLabReview } from "@/components/canvas-lab/CanvasLabReview";
import { FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import { FoundationGuide } from "@/components/canvas-lab/FoundationGuide";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { ReasoningTrailGuide } from "@/components/canvas-lab/ReasoningTrailGuide";
import { WorkRail } from "@/components/canvas-lab/WorkRail";
import {
  addLabLink,
  addLocalFrame,
  branchChatNode,
  createChatNode,
  createLabFrames,
  createLocalNode,
  deleteLocalNode,
  draftAnchor,
  fitScale,
  labAnchorPoint,
  labConnectorPath,
  localNodeAnchor,
  moveNode,
  nearestLabAnchor,
  removeContext,
  removeLabLink,
  seedCanvas,
  stageBounds,
  toggleContext,
  updateLocalNode,
  type LabComment,
  type LabAnchor,
  type LabFrame,
  type LabJudgmentType,
  type LabLink,
  type LabNode,
  type LabTemplateKind,
} from "@/components/canvas-lab/canvas-lab-model";
import {
  noteWorkboardNodeCreated,
  noteWorkboardCardMenuOpened,
  noteWorkboardNodeDeleted,
  noteWorkboardNodeEdited,
  noteWorkboardRail,
  noteWorkboardRecordVisibility,
  noteWorkboardRelationship,
  noteWorkboardReviewOpened,
  noteWorkboardTrailSelected,
  type LabNodeEventKind,
} from "@/components/canvas-lab/canvas-lab-telemetry";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Button } from "@/components/ui/button";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { dragTo, keyTo, type Point } from "@/lib/canvas-drag";
import { noteCanvasOpenedFn } from "@/lib/canvas.functions";
import { clampZoom, pinchZoom, stepZoom } from "@/lib/canvas-zoom";
import { engagementDisplayTitle } from "@/lib/clients";
import { isDeliverableType } from "@/lib/lineage-shared";
import type { WorkItemRow } from "@/lib/work-types";

function eventKind(node: LabNode): LabNodeEventKind {
  if (node.kind === "chat") return "draft_thread";
  if (node.kind === "judgment") return "human_judgment";
  if (node.kind === "ai_work") return "ai_work";
  if (node.kind === "deliverable") return "deliverable";
  if (node.kind === "decision") return "decision";
  return "source";
}

/** A local workboard over one permission-filtered engagement read. */
export function CanvasLabPage({ engagementId }: { engagementId: string }) {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: page, isLoading, isError } = useEngagementPage(engagementId);
  const noteOpened = useServerFn(noteCanvasOpenedFn);
  const unfold = useMotion("canvas.unfolded");
  const viewerName = profile?.display_name ?? "You";
  const engagement = page?.engagement ?? null;
  const orgId = profile?.org_id;

  const workItems = useMemo(() => {
    const byId = new Map<string, WorkItemRow>();
    for (const task of page?.tasks ?? []) for (const link of task.work_item_tasks ?? []) {
      const item = link.work_items;
      if (item && !byId.has(item.id)) byId.set(item.id, item as WorkItemRow);
    }
    return [...byId.values()];
  }, [page]);

  const taskIdsByWork = useMemo(() => {
    const mapping = new Map<string, string[]>();
    for (const task of page?.tasks ?? []) for (const link of task.work_item_tasks ?? []) {
      const itemId = link.work_items?.id;
      if (itemId) mapping.set(itemId, [...(mapping.get(itemId) ?? []), task.id]);
    }
    return mapping;
  }, [page]);

  const [frames, setFrames] = useState<LabFrame[] | null>(null);
  const [nodes, setNodes] = useState<LabNode[] | null>(null);
  const [links, setLinks] = useState<LabLink[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [comments, setComments] = useState<LabComment[]>([]);
  const [canvasInstructions, setCanvasInstructions] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [keyboardId, setKeyboardId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [connectSource, setConnectSource] = useState<{ nodeId: string; anchor: LabAnchor } | null>(null);
  const [connectorPreview, setConnectorPreview] = useState<Point | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [mobileView, setMobileView] = useState<"board" | "rail">("board");
  const [newFrameName, setNewFrameName] = useState("");
  const [opening, setOpening] = useState(true);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; origin: Point; from: Point } | null>(null);
  const connectorDragRef = useRef<{ nodeId: string; anchor: LabAnchor; from: Point; moved: boolean } | null>(null);
  const cardHeightsRef = useRef(new Map<string, number>());
  const panRef = useRef<{ from: Point; origin: Point } | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpening(false), 520);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!page?.engagement || nodes !== null || frames !== null) return;
    const nextFrames = createLabFrames(page.tasks ?? []);
    const nextNodes = seedCanvas({
      brief: { title: "The brief", text: page.engagement.brief },
      tasks: (page.tasks ?? []).map((task) => ({ id: task.id, name: task.name, detail: task.detail, ownedByViewer: task.owner_id === profile?.id })),
      work: workItems.map((item) => ({ id: item.id, title: item.title, typeLabel: item.type.replaceAll("_", " "), source: item.source, ownedByViewer: !item.owner_id || item.owner_id === profile?.id, taskIds: taskIdsByWork.get(item.id) ?? [], deliverable: isDeliverableType(item.type) })),
      decisions: (page.decisions ?? []).map((decision) => ({ id: decision.id, call: decision.call_text, situation: decision.situation, ownedByViewer: decision.owner_id === profile?.id })),
    }, nextFrames);
    setFrames(nextFrames);
    setNodes(nextNodes);
  }, [frames, nodes, page, profile?.id, taskIdsByWork, workItems]);

  const allNodes = nodes ?? [];
  const visibleNodes = allNodes.filter((node) => !hiddenIds.includes(node.id));
  const hiddenNodes = allNodes.filter((node) => hiddenIds.includes(node.id));
  const boardFrames = frames ?? [];
  const bounds = stageBounds(boardFrames);
  const contextNodes = visibleNodes.filter((node) => selected.includes(node.id));
  const focusNode = visibleNodes.find((node) => node.id === focusId) ?? null;
  const reviewNode = visibleNodes.find((node) => node.id === reviewId) ?? null;
  const itemByNode = (node: LabNode) => node.workItemId ? workItems.find((item) => item.id === node.workItemId) : undefined;
  const focusItem = focusNode ? itemByNode(focusNode) ?? null : null;
  const reviewItem = reviewNode ? itemByNode(reviewNode) ?? null : null;

  useEffect(() => {
    if (!nodes || openedRef.current) return;
    openedRef.current = true;
    void noteOpened({ data: { nodes: nodes.length, links: 0, shelf: 0, profile_id: profile?.id } }).catch(() => undefined);
  }, [nodes, noteOpened, profile?.id]);

  const fit = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    setZoom(clampZoom(fitScale(shell.clientWidth, shell.clientHeight, bounds)));
    setPan({ x: 0, y: 0 });
  }, [bounds.height, bounds.width]);
  useEffect(() => { fit(); }, [fit]);

  function cancelConnect(note = true) {
    if (note && (connectSource || connectorDragRef.current?.moved)) noteWorkboardRelationship(orgId, "cancelled");
    connectorDragRef.current = null;
    setConnectorPreview(null);
    setConnectSource(null);
    setAnnouncement("Connection cancelled.");
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (reviewId) setReviewId(null);
        else if (focusId) setFocusId(null);
        else if (cardMenuOpen) return;
        else if (connectSource || connectorDragRef.current) cancelConnect();
        else if (menuOpen) setMenuOpen(false);
        return;
      }
      if (cardMenuOpen) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (selectedLinkId) {
        event.preventDefault();
        setLinks((current) => removeLabLink(current, selectedLinkId));
        setSelectedLinkId(null);
        noteWorkboardRelationship(orgId, "removed");
        setAnnouncement("Local relationship removed.");
        return;
      }
      if (!keyboardId) return;
      const node = allNodes.find((entry) => entry.id === keyboardId);
      if (!node?.local && node?.kind !== "chat") return;
      event.preventDefault();
      deleteNode(node);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allNodes, cardMenuOpen, connectSource, focusId, keyboardId, menuOpen, orgId, reviewId, selectedLinkId]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    function onModifierWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => pinchZoom(current, event.deltaY));
    }
    shell.addEventListener("wheel", onModifierWheel, { passive: false });
    return () => shell.removeEventListener("wheel", onModifierWheel);
  }, []);

  function onCardPointerDown(node: LabNode, event: React.PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest("button,textarea")) return;
    event.stopPropagation();
    setKeyboardId(node.id);
    dragRef.current = { id: node.id, origin: { x: node.x, y: node.y }, from: { x: event.clientX, y: event.clientY } };
  }

  useEffect(() => {
    function move(event: PointerEvent) {
      const connector = connectorDragRef.current;
      if (connector) {
        if (!connector.moved && Math.hypot(event.clientX - connector.from.x, event.clientY - connector.from.y) < 6) return;
        if (!connector.moved) {
          connector.moved = true;
          noteWorkboardRelationship(orgId, "started");
        }
        setConnectorPreview(stagePoint(event.clientX, event.clientY));
        return;
      }
      const drag = dragRef.current;
      if (drag) {
        const delta = { x: (event.clientX - drag.from.x) / zoom, y: (event.clientY - drag.from.y) / zoom };
        setNodes((current) => current ? moveNode(current, drag.id, dragTo(drag.origin, delta)) : current);
        return;
      }
      const panning = panRef.current;
      if (panning) setPan({ x: panning.origin.x + event.clientX - panning.from.x, y: panning.origin.y + event.clientY - panning.from.y });
    }
    function up(event: PointerEvent) {
      const connector = connectorDragRef.current;
      if (connector?.moved) finishPointerConnect(connector, event);
      connectorDragRef.current = null;
      setConnectorPreview(null);
      dragRef.current = null;
      panRef.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [links, orgId, visibleNodes, zoom]);

  function onCardKeyDown(node: LabNode, event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected((current) => toggleContext(current, node.id));
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const to = keyTo({ x: node.x, y: node.y }, event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", event.shiftKey);
      setNodes((current) => current ? moveNode(current, node.id, to) : current);
    }
  }

  function addNode(kind: LabTemplateKind, judgment?: LabJudgmentType) {
    const frameId = kind === "decision" ? "decisions" : kind === "deliverable" ? "outputs" : kind === "source" ? "foundation" : boardFrames.find((frame) => frame.id.startsWith("task:"))?.id ?? "foundation";
    const frame = boardFrames.find((entry) => entry.id === frameId) ?? boardFrames[0];
    if (!frame) return;
    setNodes((current) => current ? [...current, createLocalNode(kind, frame, current, judgment)] : current);
    noteWorkboardNodeCreated(orgId, kind === "judgment" ? "human_judgment" : kind, judgment);
  }

  function deleteNode(node: LabNode) {
    setNodes((current) => {
      if (!current) return current;
      const result = deleteLocalNode(current, links, selected, node.id);
      setLinks(result.links);
      setSelected(result.selected);
      return result.nodes;
    });
    setKeyboardId(null);
    noteWorkboardNodeDeleted(orgId, eventKind(node));
    setAnnouncement(`${node.title} deleted from this local workboard.`);
  }

  function hideNode(node: LabNode) {
    setHiddenIds((current) => [...current, node.id]);
    setSelected((current) => removeContext(current, node.id));
    setKeyboardId(null);
    noteWorkboardRecordVisibility(orgId, "hidden", node.kind === "decision" ? "decision" : node.kind === "brief" ? "brief" : "work");
    setAnnouncement(`${node.title} removed from this local workboard.`);
  }

  function restoreNode(id: string) {
    const node = allNodes.find((entry) => entry.id === id);
    const frame = node ? boardFrames.find((entry) => entry.id === node.frame) : undefined;
    if (!node || !frame) return;
    const point = localNodeAnchor(frame, visibleNodes);
    setNodes((current) => current?.map((entry) => entry.id === id ? { ...entry, ...point } : entry) ?? current);
    setHiddenIds((current) => current.filter((entry) => entry !== id));
    noteWorkboardRecordVisibility(orgId, "restored", node.kind === "decision" ? "decision" : node.kind === "brief" ? "brief" : "work");
    setAnnouncement(`${node.title} returned to this local workboard.`);
  }

  function stagePoint(clientX: number, clientY: number): Point {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  }

  function createConnection(sourceId: string, sourceAnchor: LabAnchor, targetId: string, targetAnchor: LabAnchor) {
    const result = addLabLink(links, sourceId, sourceAnchor, targetId, targetAnchor);
    if (result.error) {
      noteWorkboardRelationship(orgId, "rejected");
      setAnnouncement(result.error);
      return;
    }
    setLinks(result.links);
    setConnectSource(null);
    noteWorkboardRelationship(orgId, "created");
    setAnnouncement("Local relationship created.");
  }

  function chooseConnectAnchor(node: LabNode, anchor: LabAnchor) {
    if (!connectSource) {
      setConnectSource({ nodeId: node.id, anchor });
      noteWorkboardRelationship(orgId, "started");
      setAnnouncement(`${node.title} chosen as the source. Choose a target anchor.`);
      return;
    }
    createConnection(connectSource.nodeId, connectSource.anchor, node.id, anchor);
  }

  function startPointerConnect(node: LabNode, anchor: LabAnchor, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    connectorDragRef.current = { nodeId: node.id, anchor, from: { x: event.clientX, y: event.clientY }, moved: false };
  }

  function finishPointerConnect(source: { nodeId: string; anchor: LabAnchor }, event: PointerEvent) {
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const anchorElement = element?.closest<HTMLElement>("[data-side][data-node-id]");
    const cardElement = element?.closest<HTMLElement>("[data-testid^='lab-card-']");
    const targetId = anchorElement?.dataset.nodeId ?? cardElement?.dataset.nodeId;
    const target = visibleNodes.find((node) => node.id === targetId);
    if (!target) {
      noteWorkboardRelationship(orgId, "cancelled");
      setAnnouncement("Connection cancelled.");
      return;
    }
    const explicitSide = anchorElement?.dataset.side as LabAnchor | undefined;
    const height = cardHeightsRef.current.get(target.id) ?? 108;
    const targetAnchor = explicitSide ?? nearestLabAnchor(stagePoint(event.clientX, event.clientY), target, height);
    createConnection(source.nodeId, source.anchor, target.id, targetAnchor);
  }

  function branchFrom(node: LabNode) {
    const source = node.kind === "chat" ? node : { ...node, contextIds: [node.id] };
    setNodes((current) => {
      if (!current) return current;
      const frame = boardFrames.find((entry) => entry.id === node.frame);
      const branch = branchChatNode(source);
      return [...current, frame ? { ...branch, ...localNodeAnchor(frame, current, node) } : branch];
    });
    noteWorkboardNodeCreated(orgId, "draft_thread");
  }

  function openNode(node: LabNode) {
    const item = itemByNode(node);
    if (item && isDeliverableType(item.type)) {
      setReviewId(node.id);
      noteWorkboardReviewOpened(orgId, item.type === "ai_thread" ? "thread" : item.type as "document" | "deck" | "sheet");
    } else setFocusId(node.id);
  }

  function addWorkstream() {
    const name = newFrameName.trim();
    if (!name) return;
    setFrames((current) => addLocalFrame(current ?? [], name));
    setNewFrameName("");
  }

  const title = engagement ? engagementDisplayTitle(engagement) : "Engagement";
  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--nb-paper)]" data-testid="canvas-lab-shell">
      <aside className="z-30 flex w-[52px] shrink-0 flex-col items-center border-r border-border bg-card py-3">
        <LassoLoopMark className="h-7 w-7 text-green" />
        <Button className="mt-5" size="icon" variant="ghost" aria-label="Open workboard menu" onClick={() => setMenuOpen(true)}><Menu className="h-4 w-4" /></Button>
        <Button className="mt-auto" size="icon" variant="ghost" aria-label="Back to engagement" asChild><Link to="/engagements/$id" params={{ id: engagementId }}><X className="h-4 w-4" /></Link></Button>
      </aside>
      {menuOpen ? <div className="fixed inset-0 z-50 flex bg-[var(--nb-scrim)]" onPointerDown={() => setMenuOpen(false)}><aside className="h-full w-[280px] overflow-y-auto border-r border-border bg-sidebar p-4 shadow-[var(--shadow-modal)]" onPointerDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-serif text-xl text-foreground">Lasso</span><Button size="icon" variant="ghost" aria-label="Close workboard menu" onClick={() => setMenuOpen(false)}><X className="h-4 w-4" /></Button></div><SidebarNav onNavigate={() => setMenuOpen(false)} onOpenSettings={() => void navigate({ to: "/settings" })} /><div className="mt-6 border-t border-border pt-4"><label className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft" htmlFor="canvas-lab-new-frame">Add workstream</label><div className="mt-2 flex gap-2"><input id="canvas-lab-new-frame" value={newFrameName} onChange={(event) => setNewFrameName(event.target.value)} className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-background px-2 text-[12px]" placeholder="Workstream name" /><Button size="sm" variant="outline" onClick={addWorkstream}>Add</Button></div><p className="mt-1 font-hand text-[13px] text-[var(--nb-mid)]">not saved</p></div></aside></div> : null}
      <main className={`relative min-w-0 flex-1 flex-col ${mobileView === "board" ? "flex" : "hidden md:flex"}`}>
        <header className="z-20 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4"><div className="min-w-0"><span className="block truncate text-[13px] font-medium text-foreground">{title}</span><span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Workboard · Not saved</span></div><div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" className="md:hidden" onClick={() => { setRailOpen(true); setMobileView("rail"); }}>Working from</Button>{selectedLinkId ? <Button type="button" size="sm" variant="ghost" onClick={() => { setLinks((current) => removeLabLink(current, selectedLinkId)); setSelectedLinkId(null); noteWorkboardRelationship(orgId, "removed"); }}>Remove relationship</Button> : null}<Button size="sm" variant="outline" onClick={fit}>Fit</Button><Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => setZoom((value) => stepZoom(value, "out"))}><Minus className="h-3.5 w-3.5" /></Button><span className="w-10 text-center font-mono text-[10px] text-soft">{Math.round(zoom * 100)}%</span><Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => setZoom((value) => stepZoom(value, "in"))}><Plus className="h-3.5 w-3.5" /></Button></div></header>
        <div ref={shellRef} onPointerDown={(event) => { if (event.button === 0 && event.target === event.currentTarget) panRef.current = { from: { x: event.clientX, y: event.clientY }, origin: pan }; }} className="canvas-lab-surface relative min-h-0 flex-1 cursor-grab overflow-hidden">
          <div data-testid="canvas-lab-stage" className="absolute left-0 top-0 origin-top-left" style={{ width: bounds.width, height: bounds.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <ReasoningTrailGuide onAdd={addNode} />
            <FoundationGuide brief={engagement?.brief ?? null} tasks={(page?.tasks ?? []).map((task) => ({ id: task.id, name: task.name, detail: task.detail }))} work={workItems} />
            {boardFrames.map((frame) => { const count = visibleNodes.filter((node) => node.frame === frame.id).length; return <section key={frame.id} style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }} className="absolute rounded-[var(--radius)] border border-dashed border-[var(--nb-pencil)]"><div className="absolute inset-x-3 top-2 flex items-baseline justify-between gap-2"><h2 className="font-hand text-[18px] leading-none text-[var(--nb-mid)]">{frame.name}</h2><span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{count} {frame.local ? "· local" : ""}</span></div></section>; })}
            <svg className="absolute inset-0 overflow-visible" width={bounds.width} height={bounds.height} aria-label="Local workboard relationships">
              {visibleNodes.filter((node) => node.kind === "chat").flatMap((draft) => (draft.contextIds ?? []).map((contextId) => { const source = visibleNodes.find((node) => node.id === contextId); if (!source) return null; const sx = source.x + 232; const sy = source.y + 54; const tx = draft.x; const ty = draft.y + 54; const middle = (sx + tx) / 2; return <path key={`${draft.id}:${contextId}`} d={`M ${sx} ${sy} C ${middle} ${sy}, ${middle} ${ty}, ${tx} ${ty}`} fill="none" stroke="var(--nb-graphite)" strokeWidth="1.4" strokeDasharray="4 4" strokeLinecap="round" className="pointer-events-none" />; }))}
              {links.map((link) => { const source = visibleNodes.find((node) => node.id === link.fromId); const target = visibleNodes.find((node) => node.id === link.toId); if (!source || !target) return null; const from = labAnchorPoint(source, link.fromAnchor, cardHeightsRef.current.get(source.id) ?? 108); const to = labAnchorPoint(target, link.toAnchor, cardHeightsRef.current.get(target.id) ?? 108); const active = selectedLinkId === link.id; return <path key={link.id} role="button" tabIndex={0} aria-label={`Select relationship from ${source.title} to ${target.title}`} onClick={() => setSelectedLinkId(link.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedLinkId(link.id); } }} d={labConnectorPath(from, link.fromAnchor, to, link.toAnchor)} fill="none" stroke={active ? "var(--nb-green)" : "var(--nb-graphite)"} strokeWidth={active ? "2.4" : "1.4"} strokeLinecap="round" className="cursor-pointer outline-none focus:stroke-[var(--nb-green)]" />; })}
              {connectorPreview && connectorDragRef.current ? (() => { const source = visibleNodes.find((node) => node.id === connectorDragRef.current?.nodeId); if (!source || !connectorDragRef.current) return null; const from = labAnchorPoint(source, connectorDragRef.current.anchor, cardHeightsRef.current.get(source.id) ?? 108); return <path d={labConnectorPath(from, connectorDragRef.current.anchor, connectorPreview, connectorDragRef.current.anchor)} fill="none" stroke="var(--nb-green)" strokeWidth="2.4" strokeLinecap="round" className="pointer-events-none" />; })() : null}
            </svg>
            {visibleNodes.map((node) => <LabCard key={node.id} node={node} item={itemByNode(node)} selected={selected.includes(node.id)} focused={keyboardId === node.id} connecting={connectSource !== null || connectorPreview !== null} connectSourceAnchor={connectSource?.nodeId === node.id ? connectSource.anchor : null} onSelect={() => setSelected((current) => toggleContext(current, node.id))} onOpen={() => openNode(node)} onBranch={() => branchFrom(node)} onHide={() => hideNode(node)} onDelete={() => deleteNode(node)} onEdit={(text) => setNodes((current) => current ? updateLocalNode(current, node.id, text) : current)} onEditCommitted={() => noteWorkboardNodeEdited(orgId, eventKind(node))} onAnchorPointerDown={(side, event) => startPointerConnect(node, side, event)} onAnchorActivate={(side) => chooseConnectAnchor(node, side)} onMenuOpened={() => { if (connectSource || connectorDragRef.current) cancelConnect(); noteWorkboardCardMenuOpened(orgId, eventKind(node), node.ownership); }} onMenuOpenChange={setCardMenuOpen} onMeasure={(height) => cardHeightsRef.current.set(node.id, height)} onPointerDown={(event) => onCardPointerDown(node, event)} onKeyDown={(event) => onCardKeyDown(node, event)} />)}
          </div>
          {isLoading ? <p className="absolute left-4 top-4 font-hand text-[16px] text-[var(--nb-mid)]">reading the engagement</p> : null}
          {isError ? <p className="absolute left-4 top-4 text-[13px] text-muted-foreground">This workboard could not be opened.</p> : null}
          {!isLoading && !isError && visibleNodes.length === 0 ? <p className="absolute left-4 top-4 font-hand text-[16px] text-[var(--nb-mid)]">nothing is on this workboard yet</p> : null}
        </div>
        {opening ? <div className={`pointer-events-none absolute inset-0 z-40 flex ${unfold.className}`} aria-hidden={!unfold.still}>{unfold.still ? <span className="sr-only">{unfold.reduced}</span> : null}<span className="canvas-lab-unfold-panel" /><span className="canvas-lab-unfold-panel" /><span className="canvas-lab-unfold-panel" /></div> : null}
      </main>
      <WorkRail open={railOpen} mobileVisible={mobileView === "rail"} context={contextNodes} hidden={hiddenNodes} canvasInstructions={canvasInstructions} onToggle={() => { const next = !railOpen; setRailOpen(next); noteWorkboardRail(orgId, next ? "reopened" : "collapsed"); }} onRemoveContext={(id) => setSelected((current) => removeContext(current, id))} onSubmit={(prompt) => { setNodes((current) => { if (!current) return current; const contextNode = current.find((node) => node.id === selected[0]); const frame = boardFrames.find((entry) => entry.id === (contextNode?.frame ?? "foundation")) ?? boardFrames[0]; if (!frame) return current; return [...current, createChatNode(prompt, selected, draftAnchor(frame, current), frame.id)]; }); noteWorkboardNodeCreated(orgId, "draft_thread"); }} onCanvasInstructions={setCanvasInstructions} onRestore={restoreNode} onShowBoard={() => setMobileView("board")} />
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {focusNode ? <FocusOverlay node={focusNode} item={focusItem} viewerName={viewerName} comments={comments.filter((comment) => comment.nodeId === focusNode.id)} onComment={(comment) => setComments((current) => [...current, comment])} onSummarize={() => { branchFrom({ ...focusNode, prompt: `Summarize: ${focusNode.title}` }); setFocusId(null); }} onBranch={() => { branchFrom(focusNode); setFocusId(null); }} onClose={() => setFocusId(null)} /> : null}
      {reviewItem && reviewNode ? <CanvasLabReview item={reviewItem} anchorNodeId={reviewNode.id} links={links} profileId={profile?.id} decisions={page?.decisions ?? []} nodes={visibleNodes} comments={comments} onTrailSelect={(group, focus) => noteWorkboardTrailSelected(orgId, group, focus)} onClose={() => setReviewId(null)} /> : null}
    </div>
  );
}
