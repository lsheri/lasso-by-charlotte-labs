import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Menu, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CanvasLabReview } from "@/components/canvas-lab/CanvasLabReview";
import { CanvasLabStatusLine } from "@/components/canvas-lab/CanvasLabStatusLine";
import { FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import { FoundationGuide } from "@/components/canvas-lab/FoundationGuide";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabFrame as LabFrameElement } from "@/components/canvas-lab/LabFrame";
import { ReasoningTrailGuide } from "@/components/canvas-lab/ReasoningTrailGuide";
import { WorkRail } from "@/components/canvas-lab/WorkRail";
import {
  addLabLink,
  addLocalFrame,
  applyDurableBoard,
  branchChatNode,
  createChatNode,
  containFrameMembers,
  createLabFrames,
  createLocalNode,
  deleteLocalNode,
  draftAnchor,
  fitWorkboardViewport,
  fitFrameToNodes,
  labAnchorPoint,
  labConnectorPath,
  localNodeAnchor,
  moveNode,
  dropPromptFrame,
  nextWorkstreamRect,
  nearestLabAnchor,
  removeContext,
  removeLabLink,
  seedCanvas,
  sizeSeedFrames,
  stageBounds,
  resizeLabRect,
  toggleContext,
  updateLocalNode,
  viewportSizeChanged,
  type LabComment,
  type LabAnchor,
  type LabFrame,
  type LabJudgmentType,
  type LabLink,
  type LabNode,
  type LabTemplateKind,
  type LabResizeCorner,
  type LabRect,
  type LabStructureMode,
} from "@/components/canvas-lab/canvas-lab-model";
import {
  noteWorkboardChangeSaved,
  noteWorkboardConflictResolved,
  noteWorkboardElementResized,
  noteWorkboardNodeCreated,
  noteWorkboardCardMenuOpened,
  noteWorkboardNodeDeleted,
  noteWorkboardNodeEdited,
  noteWorkboardRail,
  noteWorkboardRecordVisibility,
  noteWorkboardRelationship,
  noteWorkboardReviewOpened,
  noteWorkboardSaveFailed,
  noteWorkboardTrailSelected,
  noteWorkboardStructureToggled,
  type LabNodeEventKind,
  type WorkboardPersistEntity,
} from "@/components/canvas-lab/canvas-lab-telemetry";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Button } from "@/components/ui/button";
import { useCanvasLab } from "@/hooks/use-canvas-lab";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { dragTo, keyTo, type Point } from "@/lib/canvas-drag";
import type { WorkboardCommand, WorkboardNodeInput } from "@/lib/canvas-lab-shared";
import { noteCanvasOpenedFn } from "@/lib/canvas.functions";
import { clampZoom, pinchZoom, stepZoom, wheelPanDelta, zoomAbout } from "@/lib/canvas-zoom";
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

/** True when something between the target and the board can still scroll that way. */
function scrollableUnder(target: HTMLElement | null, shell: HTMLElement, delta: { x: number; y: number }): boolean {
  let element: HTMLElement | null = target;
  while (element && element !== shell) {
    const style = window.getComputedStyle(element);
    const scrollsY = /auto|scroll|overlay/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
    const scrollsX = /auto|scroll|overlay/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
    if (scrollsY && delta.y !== 0 && (delta.y < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight)) return true;
    if (scrollsX && delta.x !== 0 && (delta.x < 0 ? element.scrollLeft > 0 : element.scrollLeft + element.clientWidth < element.scrollWidth)) return true;
    element = element.parentElement;
  }
  return false;
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
  const lab = useCanvasLab(engagementId, profile?.id, orgId);

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
  const [newFrameError, setNewFrameError] = useState(false);
  const [inlineAddOpen, setInlineAddOpen] = useState(false);
  const [inlineFrameName, setInlineFrameName] = useState("");
  const [inlineFrameError, setInlineFrameError] = useState(false);
  const [dropPrompt, setDropPrompt] = useState<{ nodeId: string; frameId: string } | null>(null);
  const [opening, setOpening] = useState(true);
  const [interaction, setInteraction] = useState<"idle" | "drag" | "pan" | "resize" | "connect">("idle");
  const [structureMode, setStructureMode] = useState<LabStructureMode>("structured");
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; origin: Point; from: Point } | null>(null);
  const connectorDragRef = useRef<{ nodeId: string; anchor: LabAnchor; from: Point; moved: boolean } | null>(null);
  const cardHeightsRef = useRef(new Map<string, number>());
  const resizeRef = useRef<{ kind: "card" | "frame"; id: string; corner: LabResizeCorner; start: LabRect; pointer: Point; method: "pointer" | "keyboard" } | null>(null);
  const panRef = useRef<{ from: Point; origin: Point } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panStateRef = useRef<Point>(pan);
  panStateRef.current = pan;
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const openedRef = useRef(false);
  const fittedReadyRef = useRef(false);
  const viewportChangedRef = useRef(false);
  const fitInputsRef = useRef<{ frames: LabFrame[]; nodes: LabNode[]; structured: boolean }>({ frames: [], nodes: [], structured: true });
  const observedSizeRef = useRef<{ width: number; height: number } | null>(null);
  /** The deterministic virtual seed a durable board is overlaid onto. */
  const virtualBaseRef = useRef<{ frames: LabFrame[]; nodes: LabNode[] } | null>(null);


  useEffect(() => {
    if (!page?.engagement || nodes !== null || frames !== null || lab.boardLoading) return;
    const initialFrames = createLabFrames(page.tasks ?? []);
    const virtualNodes = seedCanvas({
      brief: { title: "The brief", text: page.engagement.brief },
      tasks: (page.tasks ?? []).map((task) => ({ id: task.id, name: task.name, detail: task.detail, ownedByViewer: task.owner_id === profile?.id })),
      work: workItems.map((item) => ({ id: item.id, title: item.title, typeLabel: item.type.replaceAll("_", " "), source: item.source, ownedByViewer: !item.owner_id || item.owner_id === profile?.id, taskIds: taskIdsByWork.get(item.id) ?? [], deliverable: isDeliverableType(item.type) })),
      decisions: (page.decisions ?? []).map((decision) => ({ id: decision.id, call: decision.call_text, situation: decision.situation, ownedByViewer: decision.owner_id === profile?.id })),
    }, initialFrames);
    const virtualFrames = sizeSeedFrames(initialFrames, virtualNodes);
    virtualBaseRef.current = { frames: virtualFrames, nodes: virtualNodes };
    const board = lab.board;

    if (board?.id) {
      const merged = applyDurableBoard({ frames: virtualFrames, nodes: virtualNodes }, board);
      setFrames(merged.frames);
      setNodes(merged.nodes);
      setLinks(merged.links);
      setHiddenIds(merged.hiddenIds);
      return;
    }
    setFrames(virtualFrames);
    setNodes(virtualNodes);
  }, [frames, nodes, page, profile?.id, taskIdsByWork, workItems, lab.board, lab.boardLoading]);

  const allNodes = useMemo(() => nodes ?? [], [nodes]);
  const visibleNodes = useMemo(() => allNodes.filter((node) => !hiddenIds.includes(node.id)), [allNodes, hiddenIds]);
  const hiddenNodes = useMemo(() => allNodes.filter((node) => hiddenIds.includes(node.id)), [allNodes, hiddenIds]);
  const boardFrames = useMemo(() => frames ?? [], [frames]);
  const bounds = useMemo(() => stageBounds(boardFrames), [boardFrames]);
  const contextNodes = visibleNodes.filter((node) => selected.includes(node.id));
  const focusNode = visibleNodes.find((node) => node.id === focusId) ?? null;
  const reviewNode = visibleNodes.find((node) => node.id === reviewId) ?? null;
  const itemByNode = (node: LabNode) => node.workItemId ? workItems.find((item) => item.id === node.workItemId) : undefined;
  const focusItem = focusNode ? itemByNode(focusNode) ?? null : null;
  const reviewItem = reviewNode ? itemByNode(reviewNode) ?? null : null;
  const loadingBoard = isLoading || lab.boardLoading;
  const notAvailable = !loadingBoard && !isError && !engagement;
  const boardReady = !loadingBoard && !isError && Boolean(engagement) && nodes !== null && frames !== null;
  fitInputsRef.current = { frames: boardFrames, nodes: visibleNodes, structured: structureMode === "structured" };

  useEffect(() => {
    if (!boardReady) return;
    setOpening(true);
    const timer = window.setTimeout(() => setOpening(false), 520);
    return () => window.clearTimeout(timer);
  }, [boardReady]);

  useEffect(() => {
    if (!nodes || openedRef.current) return;
    openedRef.current = true;
    void noteOpened({ data: { nodes: nodes.length, links: 0, shelf: 0, profile_id: profile?.id } }).catch(() => undefined);
  }, [nodes, noteOpened, profile?.id]);

  const fit = useCallback((manual = false) => {
    const shell = shellRef.current;
    if (!shell || !boardReady) return;
    if (manual) viewportChangedRef.current = true;
    const inputs = fitInputsRef.current;
    const result = fitWorkboardViewport(
      { width: shell.clientWidth, height: shell.clientHeight },
      inputs.structured ? inputs.frames : [],
      inputs.nodes,
      cardHeightsRef.current,
    );
    setZoom(result.zoom);
    setPan(result.pan);
  }, [boardReady]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !boardReady) return;
    const size = { width: shell.clientWidth, height: shell.clientHeight };
    if (!fittedReadyRef.current) {
      fittedReadyRef.current = true;
      observedSizeRef.current = size;
      fit();
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const next = entry
        ? { width: entry.contentRect.width, height: entry.contentRect.height }
        : { width: shell.clientWidth, height: shell.clientHeight };
      if (!viewportSizeChanged(observedSizeRef.current, next)) return;
      observedSizeRef.current = next;
      if (!viewportChangedRef.current) fit();
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [boardReady]);

  /* ---------------- Phase 3: durable save pipeline ---------------- */
  const nodesRef = useRef<LabNode[]>([]);
  nodesRef.current = allNodes;
  const framesRef = useRef<LabFrame[]>([]);
  framesRef.current = boardFrames;
  const hiddenRef = useRef<string[]>([]);
  hiddenRef.current = hiddenIds;
  const boardIdRef = useRef<string | null>(null);
  boardIdRef.current = lab.board?.id ? lab.board.id : null;

  function frameKindOf(frame: LabFrame): "foundation" | "task" | "decisions" | "outputs" | "custom" {
    if (frame.id === "foundation" || frame.id === "decisions" || frame.id === "outputs") return frame.id;
    return frame.id.startsWith("task:") ? "task" : "custom";
  }

  function nodeToInput(node: LabNode): WorkboardNodeInput | null {
    const base = { clientKey: node.clientKey ?? node.id, frameKey: node.frame, x: node.x, y: node.y, w: node.width, h: node.height, hidden: hiddenRef.current.includes(node.id) };
    if (node.kind === "work" && node.workItemId) return { ...base, kind: "work_item", workItemId: node.workItemId };
    if (node.kind === "decision" && node.id.startsWith("decision:")) return { ...base, kind: "decision", decisionId: node.id.slice(9) };
    if (node.kind === "brief") return { ...base, kind: "brief" };
    if (node.kind === "judgment" && node.local) return { ...base, kind: "judgment", title: node.title, body: node.summary, judgmentType: node.judgmentType ?? null };
    return null;
  }


  function report(result: { status: string }, entity: WorkboardPersistEntity, action: "create" | "update" | "archive" | "restore"): void {
    if (result.status === "saved") noteWorkboardChangeSaved(orgId, entity, action);
    else if (result.status === "conflict") noteWorkboardSaveFailed(orgId, entity, "conflict");
    else if (result.status === "forbidden") noteWorkboardSaveFailed(orgId, entity, "permission");
    else if (result.status === "validation_error") noteWorkboardSaveFailed(orgId, entity, "validation");
    else noteWorkboardSaveFailed(orgId, entity, "unknown");
  }

  async function materialize(): Promise<boolean> {
    if (boardIdRef.current) return true;
    const frameInputs = framesRef.current.map((frame, index) => ({
      key: frame.id,
      kind: frameKindOf(frame),
      taskId: frame.id.startsWith("task:") ? frame.id.slice(5) : null,
      label: frameKindOf(frame) === "custom" ? frame.name : null,
      x: frame.x,
      y: frame.y,
      w: frame.width,
      h: frame.height,
      ord: index,
    }));
    const nodeInputs = nodesRef.current.flatMap((node) => {
      const input = nodeToInput(node);
      return input ? [input] : [];
    });
    const result = await lab.persist({ type: "materialize", frames: frameInputs, nodes: nodeInputs });
    if (result.status !== "saved") {
      report(result, "board", "create");
      return false;
    }
    boardIdRef.current = result.boardId;
    const frameMap = result.created?.frames ?? {};
    const nodeMap = result.created?.nodes ?? {};
    setFrames((current) => current?.map((frame) => { const durableId = frameMap[frame.id]; return durableId ? { ...frame, durableId, durableVersion: 1 } : frame; }) ?? current);
    setNodes((current) => current?.map((node) => { const durableId = nodeMap[node.id]; return durableId ? { ...node, durableId, durableVersion: 1 } : node; }) ?? current);
    noteWorkboardChangeSaved(orgId, "board", "create");
    return true;
  }

  /** Give one card a durable row, creating the board first when needed. */
  async function ensureNodeDurable(localId: string): Promise<{ id: string; version: number } | null> {
    const existing = nodesRef.current.find((node) => node.id === localId);
    if (existing?.durableId) return { id: existing.durableId, version: existing.durableVersion ?? 1 };
    if (!(await materialize())) return null;
    const node = nodesRef.current.find((entry) => entry.id === localId);
    if (!node) return null;
    if (node.durableId) return { id: node.durableId, version: node.durableVersion ?? 1 };
    const input = nodeToInput(node);
    if (!input) return null;
    const result = await lab.persist({ type: "node_create", node: input });
    report(result, "node", "create");
    if (result.status !== "saved" || !result.created?.nodeId) return null;
    const id = result.created.nodeId;
    const version = result.versions[id] ?? 1;
    setNodes((current) => current?.map((entry) => entry.id === localId ? { ...entry, durableId: id, durableVersion: version } : entry) ?? current);
    return { id, version };
  }

  async function persistNodePatch(localId: string, patch: { x?: number; y?: number; w?: number; h?: number; frameId?: string | null; hidden?: boolean; title?: string; body?: string }) {
    const durable = await ensureNodeDurable(localId);
    if (!durable) return;
    const result = await lab.persist({ type: "node_update", nodeId: durable.id, expectedVersion: durable.version, patch });
    report(result, "node", "update");
    if (result.status === "saved") {
      const nextVersion = result.versions[durable.id] ?? durable.version + 1;
      setNodes((current) => current?.map((entry) => entry.durableId === durable.id ? { ...entry, durableVersion: nextVersion } : entry) ?? current);
    }
  }

  async function persistFramePatch(localId: string, patch: { x?: number; y?: number; w?: number; h?: number; label?: string }) {
    if (!(await materialize())) return;
    const frame = framesRef.current.find((entry) => entry.id === localId);
    if (!frame?.durableId) return;
    const result = await lab.persist({ type: "frame_update", frameId: frame.durableId, expectedVersion: frame.durableVersion ?? 1, patch });
    report(result, "frame", "update");
    if (result.status === "saved") setFrames((current) => current?.map((entry) => entry.id === localId ? { ...entry, durableVersion: result.versions[frame.durableId ?? ""] ?? (frame.durableVersion ?? 1) + 1 } : entry) ?? current);
  }

  async function persistLink(link: LabLink) {
    const from = await ensureNodeDurable(link.fromId);
    const to = await ensureNodeDurable(link.toId);
    if (!from || !to) return;
    const result = await lab.persist({ type: "link_create", fromNodeId: from.id, fromAnchor: link.fromAnchor, toNodeId: to.id, toAnchor: link.toAnchor, relation: "context" });
    report(result, "relationship", "create");
    if (result.status === "saved" && result.created?.linkId) {
      const id = result.created.linkId;
      const version = result.versions[id] ?? 1;
      setLinks((current) => current.map((entry) => entry.id === link.id ? { ...entry, durableId: id, durableVersion: version, relation: "context" } : entry));
    }
  }

  async function persistLinkRemoval(link: LabLink) {
    if (!link.durableId) return;
    const result = await lab.persist({ type: "link_archive", linkId: link.durableId, expectedVersion: link.durableVersion ?? 1 });
    report(result, "relationship", "archive");
  }

  /**
   * Load latest reads the whole durable board again and re-applies it over the
   * deterministic seed, so workstreams, cards and relationships all reconcile.
   * Viewport, rail, selection and unsent composer text are left alone.
   */
  function resolveConflict(choice: "latest" | "retry") {
    const state = lab.saveState;
    if (state.status !== "conflict") return;
    noteWorkboardConflictResolved(orgId, state.entityKind === "link" ? "relationship" : state.entityKind, choice);
    if (choice === "latest") {
      void (async () => {
        const fresh = await lab.refresh();
        const base = virtualBaseRef.current;
        if (fresh?.id && base) {
          const merged = applyDurableBoard(base, fresh);
          const localOnly = (nodesRef.current ?? []).filter((entry) => !entry.durableId && (entry.kind === "chat" || (entry.local && entry.kind !== "judgment")));
          setFrames(merged.frames);
          setNodes([...merged.nodes, ...localOnly]);
          setLinks(merged.links);
          setHiddenIds(merged.hiddenIds);
          setSelectedLinkId(null);
        }
        lab.clearSaveState();
        setAnnouncement("Loaded the newer version of this workboard.");
      })();
      return;
    }
    const retry = { ...state.retry, expectedVersion: state.latestVersion } as WorkboardCommand;
    lab.clearSaveState();
    void lab.persist(retry).then((result) => report(result, state.entityKind === "link" ? "relationship" : state.entityKind, "update"));
    setAnnouncement("Retried your change.");
  }


  /* ---------------- end durable save pipeline ---------------- */

  function cancelConnect(note = true) {
    if (note && (connectSource || connectorDragRef.current?.moved)) noteWorkboardRelationship(orgId, "cancelled");
    connectorDragRef.current = null;
    setConnectorPreview(null);
    setConnectSource(null);
    setInteraction("idle");
    setAnnouncement("Connection cancelled.");
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (dropPrompt) { setDropPrompt(null); return; }
        const resize = resizeRef.current;
        if (resize) {
          if (resize.kind === "card") setNodes((current) => current?.map((node) => node.id === resize.id ? { ...node, ...resize.start } : node) ?? current);
          else setFrames((current) => current?.map((frame) => frame.id === resize.id ? { ...frame, ...resize.start } : frame) ?? current);
          resizeRef.current = null;
          setInteraction("idle");
          setAnnouncement("Resize cancelled.");
          return;
        }
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
        const link = links.find((entry) => entry.id === selectedLinkId);
        if (link) void persistLinkRemoval(link);
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
  }, [allNodes, cardMenuOpen, connectSource, dropPrompt, focusId, keyboardId, menuOpen, orgId, reviewId, selectedLinkId]);

  useEffect(() => {
    if (!dropPrompt) return;
    function close(event: PointerEvent) {
      if ((event.target as Element | null)?.closest("[data-drop-prompt='true']")) return;
      setDropPrompt(null);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [dropPrompt]);

  /** Change the zoom while holding one point of the board still. */
  const zoomTo = useCallback((next: number, point: Point) => {
    const from = zoomRef.current;
    const to = clampZoom(next);
    if (to === from) return;
    viewportChangedRef.current = true;
    setPan(zoomAbout(panStateRef.current, from, to, point));
    setZoom(to);
  }, []);

  /** The middle of what the person can currently see. */
  const viewportCentre = useCallback((): Point => {
    const shell = shellRef.current;
    if (!shell) return { x: 0, y: 0 };
    return { x: shell.clientWidth / 2, y: shell.clientHeight / 2 };
  }, []);

  const zoomAtCentre = useCallback((next: number) => zoomTo(next, viewportCentre()), [viewportCentre, zoomTo]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    function pointIn(event: WheelEvent): Point {
      const rect = shell!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function onModifierWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      viewportChangedRef.current = true;
      zoomTo(pinchZoom(zoomRef.current, event.deltaY), pointIn(event));
    }
    function onSurfaceWheel(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea,input,[contenteditable='true'],[role='menu'],[data-radix-popper-content-wrapper]")) return;
      const delta = wheelPanDelta(event);
      if (scrollableUnder(target, shell!, delta)) return;
      event.preventDefault();
      viewportChangedRef.current = true;
      setPan((current) => ({ x: current.x - delta.x, y: current.y - delta.y }));
    }
    shell.addEventListener("wheel", onModifierWheel, { passive: false });
    shell.addEventListener("wheel", onSurfaceWheel, { passive: false });
    return () => { shell.removeEventListener("wheel", onModifierWheel); shell.removeEventListener("wheel", onSurfaceWheel); };
  }, [zoomTo]);

  /** Space pans only from the document or board itself; controls keep native Space. */
  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.key !== " " && event.code !== "Space") return;
      const active = document.activeElement as HTMLElement | null;
      const shell = shellRef.current;
      const stage = shell?.querySelector<HTMLElement>("[data-testid='canvas-lab-stage']") ?? null;
      if (active !== document.body && active !== shell && active !== stage) return;
      if (spaceRef.current) return;
      event.preventDefault();
      spaceRef.current = true;
      setSpaceHeld(true);
    }
    function up(event: KeyboardEvent) {
      if (event.key !== " " && event.code !== "Space") return;
      spaceRef.current = false;
      setSpaceHeld(false);
    }
    function blur() { spaceRef.current = false; setSpaceHeld(false); }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  /** Ctrl or Cmd with =, -, 0 and 1, instead of the browser's page zoom. */
  useEffect(() => {
    function onZoomKey(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest("textarea,input,[contenteditable='true']")) return;
      if (event.key === "=" || event.key === "+") { event.preventDefault(); zoomAtCentre(stepZoom(zoomRef.current, "in")); return; }
      if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomAtCentre(stepZoom(zoomRef.current, "out")); return; }
      if (event.key === "0") { event.preventDefault(); fit(true); return; }
      if (event.key === "1") { event.preventDefault(); zoomAtCentre(1); }
    }
    window.addEventListener("keydown", onZoomKey, { passive: false });
    return () => window.removeEventListener("keydown", onZoomKey);
  }, [fit, zoomAtCentre]);

  function startSpacePan(event: React.PointerEvent) {
    viewportChangedRef.current = true;
    setInteraction("pan");
    panRef.current = { from: { x: event.clientX, y: event.clientY }, origin: panStateRef.current };
  }

  function onCardPointerDown(node: LabNode, event: React.PointerEvent) {
    if (spaceRef.current) return; // Space pans the board, even over a card.
    if (event.button !== 0 || (event.target as Element).closest("button,textarea")) return;
    event.stopPropagation();
    setDropPrompt(null);
    setKeyboardId(node.id);
    setInteraction("drag");
    dragRef.current = { id: node.id, origin: { x: node.x, y: node.y }, from: { x: event.clientX, y: event.clientY } };
  }

  useEffect(() => {
    function move(event: PointerEvent) {
      const connector = connectorDragRef.current;
      if (connector) {
        if (!connector.moved && Math.hypot(event.clientX - connector.from.x, event.clientY - connector.from.y) < 6) return;
        if (!connector.moved) {
          connector.moved = true;
          setInteraction("connect");
          noteWorkboardRelationship(orgId, "started");
        }
        setConnectorPreview(stagePoint(event.clientX, event.clientY));
        return;
      }
      const resizing = resizeRef.current;
      if (resizing?.method === "pointer") {
        const rect = resizeLabRect(resizing.start, resizing.corner, { x: (event.clientX - resizing.pointer.x) / zoom, y: (event.clientY - resizing.pointer.y) / zoom }, event.shiftKey, resizing.kind);
        if (resizing.kind === "card") setNodes((current) => current?.map((node) => node.id === resizing.id ? { ...node, ...rect } : node) ?? current);
        else setFrames((current) => current?.map((frame) => frame.id === resizing.id ? { ...frame, ...containFrameMembers(rect, frame.id, nodesRef.current) } : frame) ?? current);
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
      const drag = dragRef.current;
      if (drag) {
        const moved = nodesRef.current.find((node) => node.id === drag.id);
        if (moved && (moved.x !== drag.origin.x || moved.y !== drag.origin.y)) {
          void persistNodePatch(drag.id, { x: moved.x, y: moved.y });
          const target = dropPromptFrame(moved, framesRef.current, structureMode, Boolean(lab.board?.canEditStructure) && (moved.kind !== "judgment" || Boolean(moved.local)));
          if (target) {
            setDropPrompt({ nodeId: moved.id, frameId: target.id });
            setAnnouncement(`Move to ${target.name}?`);
          }
        }
      }
      dragRef.current = null;
      const resizing = resizeRef.current;
      if (resizing?.method === "pointer") {
        if (resizing.kind === "card") {
          const node = nodesRef.current.find((entry) => entry.id === resizing.id);
          if (node && (node.x !== resizing.start.x || node.y !== resizing.start.y || node.width !== resizing.start.width || node.height !== resizing.start.height)) {
            void persistNodePatch(node.id, { x: node.x, y: node.y, w: node.width, h: node.height });
            noteWorkboardElementResized(orgId, "card", "pointer", resizeAxis(resizing.start, { x: node.x, y: node.y, width: node.width, height: node.height }));
          }
        } else {
          const frame = framesRef.current.find((entry) => entry.id === resizing.id);
          if (frame && (frame.x !== resizing.start.x || frame.y !== resizing.start.y || frame.width !== resizing.start.width || frame.height !== resizing.start.height)) {
            void persistFramePatch(frame.id, { x: frame.x, y: frame.y, w: frame.width, h: frame.height });
            noteWorkboardElementResized(orgId, "frame", "pointer", resizeAxis(resizing.start, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }));
          }
        }
        resizeRef.current = null;
      }
      panRef.current = null;
      setInteraction("idle");
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [lab.board?.canEditStructure, links, orgId, structureMode, visibleNodes, zoom]);

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
      void persistNodePatch(node.id, { x: to.x, y: to.y });
    }
  }

  function startResize(kind: "card" | "frame", id: string, corner: LabResizeCorner, rect: LabRect, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    connectorDragRef.current = null;
    setInteraction("resize");
    resizeRef.current = { kind, id, corner, start: rect, pointer: { x: event.clientX, y: event.clientY }, method: "pointer" };
  }

  function resizeAxis(start: LabRect, end: LabRect): "horizontal" | "vertical" | "both" {
    const horizontal = start.width !== end.width;
    const vertical = start.height !== end.height;
    return horizontal && vertical ? "both" : horizontal ? "horizontal" : "vertical";
  }

  function keyboardResize(kind: "card" | "frame", id: string, corner: LabResizeCorner, rect: LabRect, event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    event.stopPropagation();
    const amount = event.shiftKey ? 24 : 8;
    const delta = { x: event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0, y: event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0 };
    if (!resizeRef.current) resizeRef.current = { kind, id, corner, start: rect, pointer: { x: 0, y: 0 }, method: "keyboard" };
    setInteraction("resize");
    const resized = resizeLabRect(rect, corner, delta, event.shiftKey, kind);
    const next = kind === "frame" ? containFrameMembers(resized, id, nodesRef.current) : resized;
    if (kind === "card") setNodes((current) => current?.map((node) => node.id === id ? { ...node, ...next } : node) ?? current);
    else setFrames((current) => current?.map((frame) => frame.id === id ? { ...frame, ...next } : frame) ?? current);
  }

  function finishKeyboardResize(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!event.key.startsWith("Arrow")) return;
    const resizing = resizeRef.current;
    if (!resizing || resizing.method !== "keyboard") return;
    let end: LabRect | null = null;
    if (resizing.kind === "card") {
      const node = nodesRef.current.find((entry) => entry.id === resizing.id);
      if (node) { end = { x: node.x, y: node.y, width: node.width, height: node.height }; void persistNodePatch(node.id, { x: node.x, y: node.y, w: node.width, h: node.height }); }
    } else {
      const frame = framesRef.current.find((entry) => entry.id === resizing.id);
      if (frame) { end = { x: frame.x, y: frame.y, width: frame.width, height: frame.height }; void persistFramePatch(frame.id, { x: frame.x, y: frame.y, w: frame.width, h: frame.height }); }
    }
    if (end) noteWorkboardElementResized(orgId, resizing.kind, "keyboard", resizeAxis(resizing.start, end));
    resizeRef.current = null;
    setInteraction("idle");
  }

  function fitCard(node: LabNode) {
    const height = Math.max(112, Math.min(520, cardHeightsRef.current.get(node.id) ?? node.height));
    if (node.width === 232 && node.height === height) return;
    setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, width: 232, height } : entry) ?? current);
    void persistNodePatch(node.id, { w: 232, h: height });
    noteWorkboardElementResized(orgId, "card", "fit_content", "both");
  }

  function fitFrame(frame: LabFrame) {
    const rect = fitFrameToNodes(frame, visibleNodes);
    if (!rect) { setAnnouncement("This workstream has no cards to fit."); return; }
    setFrames((current) => current?.map((entry) => entry.id === frame.id ? { ...entry, ...rect } : entry) ?? current);
    void persistFramePatch(frame.id, { x: rect.x, y: rect.y, w: rect.width, h: rect.height });
    noteWorkboardElementResized(orgId, "frame", "fit_content", "both");
  }

  function renameFrame(frame: LabFrame, name: string) {
    setFrames((current) => current?.map((entry) => entry.id === frame.id ? { ...entry, name } : entry) ?? current);
    if (frame.durableId) void persistFramePatch(frame.id, { label: name });
  }

  function removeFrame(frame: LabFrame) {
    if (allNodes.some((node) => node.frame === frame.id)) {
      setAnnouncement("Move its cards first.");
      return;
    }
    if (!frame.durableId) {
      setFrames((entries) => entries?.filter((entry) => entry.id !== frame.id) ?? entries);
      setSelectedFrameId((selectedId) => selectedId === frame.id ? null : selectedId);
      setAnnouncement("Workstream removed");
      return;
    }
    void (async () => {
      if (!(await materialize())) return;
      const current = framesRef.current.find((entry) => entry.id === frame.id);
      if (!current?.durableId) return;
      const result = await lab.persist({ type: "frame_archive", frameId: current.durableId, expectedVersion: current.durableVersion ?? 1 });
      report(result, "frame", "archive");
      if (result.status !== "saved") return;
      setFrames((entries) => entries?.filter((entry) => entry.id !== frame.id) ?? entries);
      setSelectedFrameId((selectedId) => selectedId === frame.id ? null : selectedId);
      setAnnouncement("Workstream removed");
    })();
  }

  function moveToFrame(node: LabNode, frameId: string) {
    const target = framesRef.current.find((frame) => frame.id === frameId);
    if (!target) return;
    void (async () => {
      if (!(await materialize())) return;
      const durableTarget = framesRef.current.find((frame) => frame.id === frameId)?.durableId;
      if (!durableTarget) return;
      setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, frame: frameId } : entry) ?? current);
      await persistNodePatch(node.id, { frameId: durableTarget });
      setAnnouncement(`${node.title} moved to ${target.name}.`);
    })();
  }

  function addNode(kind: LabTemplateKind, judgment?: LabJudgmentType) {
    const frameId = kind === "decision" ? "decisions" : kind === "deliverable" ? "outputs" : kind === "source" ? "foundation" : boardFrames.find((frame) => frame.id.startsWith("task:"))?.id ?? "foundation";
    const frame = boardFrames.find((entry) => entry.id === frameId) ?? boardFrames[0];
    if (!frame) return;
    const node = createLocalNode(kind, frame, allNodes, judgment);
    setNodes((current) => current ? [...current, node] : current);
    noteWorkboardNodeCreated(orgId, kind === "judgment" ? "human_judgment" : kind, judgment);
    if (kind === "judgment") {
      void (async () => {
        if (!(await materialize())) return;
        const input = nodeToInput(node);
        if (!input) return;
        const result = await lab.persist({ type: "node_create", node: input });
        report(result, "node", "create");
        if (result.status === "saved" && result.created?.nodeId) {
          const id = result.created.nodeId;
          setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, durableId: id, durableVersion: result.versions[id] ?? 1 } : entry) ?? current);
        }
      })();
    }
  }

  function deleteNode(node: LabNode) {
    // A judgment belongs to whoever wrote it. Nobody else removes it, and the
    // author's removal is a soft archive the record keeps.
    if ((node.kind === "judgment" || node.kind === "chat") && !node.local) {
      setAnnouncement("This card belongs to a teammate, so only they can remove it.");
      return;
    }
    if (node.durableId) {
      void lab
        .persist({ type: "node_archive", nodeId: node.durableId, expectedVersion: node.durableVersion ?? 1 })
        .then((result) => report(result, "node", "archive"));
    }
    setNodes((current) => {
      if (!current) return current;
      const result = deleteLocalNode(current, links, selected, node.id);
      setLinks(result.links);
      setSelected(result.selected);
      return result.nodes;
    });
    setKeyboardId(null);
    noteWorkboardNodeDeleted(orgId, eventKind(node));
    setAnnouncement(`${node.title} removed from this workboard.`);
  }


  function hideNode(node: LabNode) {
    setHiddenIds((current) => [...current, node.id]);
    void persistNodePatch(node.id, { hidden: true });
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
    void persistNodePatch(id, { hidden: false, x: point.x, y: point.y });
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
    setInteraction("idle");
    noteWorkboardRelationship(orgId, "created");
    const created = result.links[result.links.length - 1];
    if (created) void persistLink(created);
    setAnnouncement("Relationship saved to the workboard.");
  }

  function chooseConnectAnchor(node: LabNode, anchor: LabAnchor) {
    if (!connectSource) {
      setConnectSource({ nodeId: node.id, anchor });
      setInteraction("connect");
      noteWorkboardRelationship(orgId, "started");
      setAnnouncement(`${node.title} chosen as the source. Choose a target anchor.`);
      return;
    }
    createConnection(connectSource.nodeId, connectSource.anchor, node.id, anchor);
  }

  function startPointerConnect(node: LabNode, anchor: LabAnchor, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setInteraction("connect");
    connectorDragRef.current = { nodeId: node.id, anchor, from: { x: event.clientX, y: event.clientY }, moved: false };
  }

  function finishPointerConnect(source: { nodeId: string; anchor: LabAnchor }, event: PointerEvent) {
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const anchorElement = element?.closest<HTMLElement>("[data-side][data-node-id]");
    const cardElement = element?.closest<HTMLElement>("[data-testid^='lab-card-']");
    const targetId = anchorElement?.dataset["nodeId"] ?? cardElement?.dataset["nodeId"];
    const target = visibleNodes.find((node) => node.id === targetId);
    if (!target) {
      noteWorkboardRelationship(orgId, "cancelled");
      setAnnouncement("Connection cancelled.");
      return;
    }
    const explicitSide = anchorElement?.dataset["side"] as LabAnchor | undefined;
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

  function addWorkstream(nameInput: string): boolean {
    const name = nameInput.trim();
    if (!name || name.length > 60) return false;
    const next = addLocalFrame(framesRef.current, name, nextWorkstreamRect(framesRef.current, nodesRef.current.filter((node) => !hiddenIds.includes(node.id))));
    const frame = next[next.length - 1];
    setFrames(next);
    if (!frame) return false;
    void (async () => {
      const boardExisted = boardIdRef.current != null;
      if (!(await materialize())) return;
      if (!boardExisted) return; // materialize already carried the new frame
      const result = await lab.persist({ type: "frame_create", frame: { key: frame.id, kind: "custom", label: name, x: frame.x, y: frame.y, w: frame.width, h: frame.height, ord: 0 } });
      report(result, "frame", "create");
      if (result.status === "saved" && result.created?.frameId) {
        const id = result.created.frameId;
        setFrames((current) => current?.map((entry) => entry.id === frame.id ? { ...entry, durableId: id, durableVersion: result.versions[id] ?? 1 } : entry) ?? current);
      }
    })();
    return true;
  }

  const title = engagement ? engagementDisplayTitle(engagement) : "Workboard";
  const status = loadingBoard || (boardReady && opening)
    ? "Workboard · Opening"
    : lab.saveState.status === "saving" ? "Workboard · Saving"
      : lab.saveState.status === "conflict" ? "Workboard · Newer version available"
        : lab.saveState.status === "forbidden" ? "Workboard · Read only"
          : lab.saveState.status === "error" ? "Workboard · Could not save"
            : lab.board?.id ? "Workboard · Saved"
              : "Workboard · Not saved";
  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--nb-paper)]" data-testid="canvas-lab-shell" data-interaction={interaction === "idle" && connectSource ? "connect" : interaction}>
      <aside className="z-30 flex w-[52px] shrink-0 flex-col items-center border-r border-border bg-card py-3">
        <LassoLoopMark className="h-7 w-7 text-green" />
        <Button className="mt-5" size="icon" variant="ghost" aria-label="Open workboard menu" onClick={() => setMenuOpen(true)}><Menu className="h-4 w-4" /></Button>
        <Button className="mt-auto" size="icon" variant="ghost" aria-label="Back to engagement" asChild><Link to="/engagements/$id" params={{ id: engagementId }}><X className="h-4 w-4" /></Link></Button>
      </aside>
      {menuOpen ? <div className="fixed inset-0 z-50 flex bg-[var(--nb-scrim)]" onPointerDown={() => setMenuOpen(false)}><aside className="h-full w-[280px] overflow-y-auto border-r border-border bg-sidebar p-4 shadow-[var(--shadow-modal)]" onPointerDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-serif text-xl text-foreground">Lasso</span><Button size="icon" variant="ghost" aria-label="Close workboard menu" onClick={() => setMenuOpen(false)}><X className="h-4 w-4" /></Button></div><SidebarNav onNavigate={() => setMenuOpen(false)} onOpenSettings={() => void navigate({ to: "/settings" })} /><div className="mt-6 border-t border-border pt-4"><label className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft" htmlFor="canvas-lab-new-frame">Add workstream</label><div className="mt-2 flex gap-2"><input id="canvas-lab-new-frame" maxLength={60} value={newFrameName} onChange={(event) => { setNewFrameName(event.target.value); if (event.target.value.trim()) setNewFrameError(false); }} className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-background px-2 text-[12px]" placeholder="Workstream name" /><Button size="sm" variant="outline" onClick={() => { if (addWorkstream(newFrameName)) { setNewFrameName(""); setNewFrameError(false); } else setNewFrameError(true); }}>Add</Button></div>{newFrameError ? <p className="mt-1 font-hand text-[13px] text-destructive">a workstream needs a name</p> : <p className="mt-1 font-hand text-[13px] text-[var(--nb-mid)]">not saved</p>}</div></aside></div> : null}
      <main className={`relative min-w-0 flex-1 flex-col ${mobileView === "board" ? "flex" : "hidden md:flex"}`}>
        <header className="z-20 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4"><div className="min-w-0"><span className="block truncate text-[13px] font-medium text-foreground">{title}</span><span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{status}</span></div><div className="flex items-center gap-1"><div className="canvas-lab-structure-toggle" aria-label="Workboard structure"><Button type="button" size="sm" variant={structureMode === "structured" ? "secondary" : "ghost"} aria-pressed={structureMode === "structured"} onClick={() => { if (structureMode === "structured") return; setStructureMode("structured"); noteWorkboardStructureToggled(orgId, "structured"); }}>Structured</Button><Button type="button" size="sm" variant={structureMode === "freeform" ? "secondary" : "ghost"} aria-pressed={structureMode === "freeform"} onClick={() => { if (structureMode === "freeform") return; setStructureMode("freeform"); setSelectedFrameId(null); noteWorkboardStructureToggled(orgId, "freeform"); }}>Freeform</Button></div><Button type="button" size="sm" variant="outline" className="md:hidden" onClick={() => { setRailOpen(true); setMobileView("rail"); }}>Working from</Button>{selectedLinkId ? <Button type="button" size="sm" variant="ghost" onClick={() => { const link = links.find((entry) => entry.id === selectedLinkId); if (link) void persistLinkRemoval(link); setLinks((current) => removeLabLink(current, selectedLinkId)); setSelectedLinkId(null); noteWorkboardRelationship(orgId, "removed"); }}>Remove relationship</Button> : null}<Button size="sm" variant="outline" onClick={() => fit(true)}>Fit</Button><Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => zoomAtCentre(stepZoom(zoomRef.current, "out"))}><Minus className="h-3.5 w-3.5" /></Button><button type="button" aria-label="Zoom to 100 percent" className="w-10 text-center font-mono text-[10px] text-soft" onClick={() => zoomAtCentre(1)}>{Math.round(zoom * 100)}%</button><Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => zoomAtCentre(stepZoom(zoomRef.current, "in"))}><Plus className="h-3.5 w-3.5" /></Button></div></header>
        {lab.saveState.status === "conflict" ? <div className="z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2" role="alert"><p className="text-[13px] text-foreground">Someone saved a newer version of this record.</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => resolveConflict("latest")}>Load latest</Button><Button size="sm" variant="outline" onClick={() => resolveConflict("retry")}>Retry my change</Button></div></div> : null}
        <div ref={shellRef} tabIndex={-1} onPointerDownCapture={(event) => { if (event.button === 0 && spaceRef.current) { event.preventDefault(); event.stopPropagation(); startSpacePan(event); } }} onPointerDown={(event) => { if (event.button === 0 && event.target === event.currentTarget) { viewportChangedRef.current = true; setInteraction("pan"); panRef.current = { from: { x: event.clientX, y: event.clientY }, origin: pan }; } }} data-space-pan={spaceHeld} className="canvas-lab-surface relative min-h-0 flex-1 overflow-hidden">
          {boardReady ? <div data-testid="canvas-lab-stage" tabIndex={-1} className="canvas-lab-stage absolute left-0 top-0 origin-top-left" style={{ width: bounds.width, height: bounds.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <ReasoningTrailGuide onAdd={addNode} />
            <FoundationGuide brief={engagement?.brief ?? null} tasks={(page?.tasks ?? []).map((task) => ({ id: task.id, name: task.name, detail: task.detail }))} work={workItems} />
            {structureMode === "structured" ? boardFrames.map((frame) => { const kind = frameKindOf(frame); const count = visibleNodes.filter((node) => node.frame === frame.id).length; const custom = kind === "custom"; const removable = !allNodes.some((node) => node.frame === frame.id); return <LabFrameElement key={frame.id} frame={frame} count={count} selected={selectedFrameId === frame.id} editable={Boolean(lab.board?.canEditStructure)} custom={custom} kind={kind} namedByWorkstream={kind === "task"} removable={removable} onSelect={() => { setSelectedFrameId(frame.id); setKeyboardId(null); }} onResizeStart={(corner, event) => startResize("frame", frame.id, corner, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, event)} onResizeKeyDown={(corner, event) => keyboardResize("frame", frame.id, corner, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, event)} onResizeKeyUp={finishKeyboardResize} onFit={() => fitFrame(frame)} onRename={(name) => renameFrame(frame, name)} onRemove={() => removeFrame(frame)} onMenuOpened={() => noteWorkboardCardMenuOpened(orgId, "frame", "shared")} onMenuOpenChange={setCardMenuOpen} onAddWorkstream={frame.id === "workstreams" ? addWorkstream : undefined} />; }) : null}
            {structureMode === "structured" && Boolean(lab.board?.canEditStructure) && !boardFrames.some((frame) => frame.id === "workstreams") ? (() => { const anchor = workstreamAddAnchor(boardFrames, visibleNodes); if (!anchor) return null; return <div className="canvas-lab-inline-add" style={{ left: anchor.x, top: anchor.y, transform: `scale(${1 / zoom})`, transformOrigin: "top left" }}>{inlineAddOpen ? <div className="canvas-lab-inline-workstream"><input aria-label="Workstream name" maxLength={60} value={inlineFrameName} onChange={(event) => { setInlineFrameName(event.target.value); if (event.target.value.trim()) setInlineFrameError(false); }} onKeyDown={(event) => { if (event.key === "Enter" && addWorkstream(inlineFrameName)) { setInlineFrameName(""); setInlineFrameError(false); setInlineAddOpen(false); } if (event.key === "Escape") { setInlineAddOpen(false); setInlineFrameError(false); } }} /><button type="button" onClick={() => { if (addWorkstream(inlineFrameName)) { setInlineFrameName(""); setInlineFrameError(false); setInlineAddOpen(false); } else setInlineFrameError(true); }}>Add</button>{inlineFrameError ? <span>a workstream needs a name</span> : null}</div> : <button type="button" className="canvas-lab-add-workstream" onClick={() => setInlineAddOpen(true)}>+ workstream</button>}</div>; })() : null}
            <svg className="canvas-lab-relationships absolute inset-0 overflow-visible" width={bounds.width} height={bounds.height} aria-label="Local workboard relationships">
              {visibleNodes.filter((node) => node.kind === "chat").flatMap((draft) => (draft.contextIds ?? []).map((contextId) => { const source = visibleNodes.find((node) => node.id === contextId); if (!source) return null; const sx = source.x + source.width; const sy = source.y + source.height / 2; const tx = draft.x; const ty = draft.y + draft.height / 2; const middle = (sx + tx) / 2; return <path key={`${draft.id}:${contextId}`} d={`M ${sx} ${sy} C ${middle} ${sy}, ${middle} ${ty}, ${tx} ${ty}`} fill="none" stroke="var(--nb-graphite)" strokeWidth="1.4" strokeDasharray="4 4" strokeLinecap="round" className="pointer-events-none" />; }))}
              {links.map((link) => { const source = visibleNodes.find((node) => node.id === link.fromId); const target = visibleNodes.find((node) => node.id === link.toId); if (!source || !target) return null; const from = labAnchorPoint(source, link.fromAnchor, cardHeightsRef.current.get(source.id) ?? 108); const to = labAnchorPoint(target, link.toAnchor, cardHeightsRef.current.get(target.id) ?? 108); const active = selectedLinkId === link.id; const path = labConnectorPath(from, link.fromAnchor, to, link.toAnchor); const selectLink = () => setSelectedLinkId(link.id); return <g key={link.id}><path d={path} fill="none" stroke="transparent" strokeWidth="10" className="canvas-lab-relationship-hit" onClick={selectLink} /><path role="button" tabIndex={0} aria-label={`Select relationship from ${source.title} to ${target.title}`} onClick={selectLink} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLink(); } }} d={path} fill="none" stroke={active ? "var(--nb-green)" : "var(--nb-graphite)"} strokeWidth={active ? "2.4" : "1.4"} strokeLinecap="round" className="canvas-lab-relationship-line cursor-pointer outline-none focus:stroke-[var(--nb-green)]" /></g>; })}
              {connectorPreview && connectorDragRef.current ? (() => { const source = visibleNodes.find((node) => node.id === connectorDragRef.current?.nodeId); if (!source || !connectorDragRef.current) return null; const from = labAnchorPoint(source, connectorDragRef.current.anchor, cardHeightsRef.current.get(source.id) ?? 108); return <path d={labConnectorPath(from, connectorDragRef.current.anchor, connectorPreview, connectorDragRef.current.anchor)} fill="none" stroke="var(--nb-green)" strokeWidth="2.4" strokeLinecap="round" className="pointer-events-none" />; })() : null}
            </svg>
            {visibleNodes.map((node) => { const canResize = Boolean(lab.board?.canEditStructure) && (node.kind !== "judgment" || Boolean(node.local)); return <LabCard key={node.id} node={node} item={itemByNode(node)} selected={selected.includes(node.id)} focused={keyboardId === node.id} connecting={connectSource !== null || connectorPreview !== null} connectSourceAnchor={connectSource?.nodeId === node.id ? connectSource.anchor : null} onSelect={() => setSelected((current) => toggleContext(current, node.id))} onOpen={() => openNode(node)} onBranch={() => branchFrom(node)} onHide={() => hideNode(node)} onDelete={() => deleteNode(node)} onEdit={(text) => setNodes((current) => current ? updateLocalNode(current, node.id, text) : current)} onEditCommitted={() => { noteWorkboardNodeEdited(orgId, eventKind(node)); const current = nodesRef.current.find((entry) => entry.id === node.id); if (current?.durableId) void persistNodePatch(current.id, { body: current.summary, title: current.title }); }} onAnchorPointerDown={(side, event) => startPointerConnect(node, side, event)} onAnchorActivate={(side) => chooseConnectAnchor(node, side)} onMenuOpened={() => { if (connectSource || connectorDragRef.current) cancelConnect(); noteWorkboardCardMenuOpened(orgId, eventKind(node), node.ownership); }} onMenuOpenChange={setCardMenuOpen} onMeasure={(height) => cardHeightsRef.current.set(node.id, height)} onPointerDown={(event) => onCardPointerDown(node, event)} onKeyDown={(event) => onCardKeyDown(node, event)} canResize={canResize} onResizeStart={(corner, event) => startResize("card", node.id, corner, { x: node.x, y: node.y, width: node.width, height: node.height }, event)} onResizeKeyDown={(corner, event) => keyboardResize("card", node.id, corner, { x: node.x, y: node.y, width: node.width, height: node.height }, event)} onResizeKeyUp={finishKeyboardResize} onFit={() => fitCard(node)} frameChoices={boardFrames.map((frame) => ({ id: frame.id, name: frame.name }))} structured={structureMode === "structured"} onMoveToFrame={(frameId) => moveToFrame(node, frameId)} />; })}
            {dropPrompt ? (() => { const node = visibleNodes.find((entry) => entry.id === dropPrompt.nodeId); const frame = boardFrames.find((entry) => entry.id === dropPrompt.frameId); if (!node || !frame) return null; return <div data-drop-prompt="true" className="canvas-lab-drop-prompt" style={{ left: node.x, top: node.y + node.height + 10 }}><span>Move to {frame.name}?</span><button type="button" onClick={() => { moveToFrame(node, frame.id); setDropPrompt(null); }}>Yes</button><button type="button" onClick={() => setDropPrompt(null)}>Keep</button></div>; })() : null}
          </div> : null}
          <CanvasLabStatusLine loading={loadingBoard} unavailable={isError || notAvailable} empty={boardReady && visibleNodes.length === 0} />
        </div>
        {boardReady && opening ? <div className={`pointer-events-none absolute inset-0 z-40 flex ${unfold.className}`} aria-hidden={!unfold.still}>{unfold.still ? <span className="sr-only">{unfold.reduced}</span> : null}<span className="canvas-lab-unfold-panel" /><span className="canvas-lab-unfold-panel" /><span className="canvas-lab-unfold-panel" /></div> : null}
      </main>
      <WorkRail open={railOpen} mobileVisible={mobileView === "rail"} context={contextNodes} hidden={hiddenNodes} canvasInstructions={canvasInstructions} onToggle={() => { const next = !railOpen; setRailOpen(next); noteWorkboardRail(orgId, next ? "reopened" : "collapsed"); }} onRemoveContext={(id) => setSelected((current) => removeContext(current, id))} onSubmit={(prompt) => { setNodes((current) => { if (!current) return current; const contextNode = current.find((node) => node.id === selected[0]); const frame = boardFrames.find((entry) => entry.id === (contextNode?.frame ?? "foundation")) ?? boardFrames[0]; if (!frame) return current; return [...current, createChatNode(prompt, selected, draftAnchor(frame, current), frame.id)]; }); noteWorkboardNodeCreated(orgId, "draft_thread"); }} onCanvasInstructions={setCanvasInstructions} onRestore={restoreNode} onShowBoard={() => setMobileView("board")} />
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {focusNode ? <FocusOverlay node={focusNode} item={focusItem} viewerName={viewerName} comments={comments.filter((comment) => comment.nodeId === focusNode.id)} onComment={(comment) => setComments((current) => [...current, comment])} onSummarize={() => { branchFrom({ ...focusNode, prompt: `Summarize: ${focusNode.title}` }); setFocusId(null); }} onBranch={() => { branchFrom(focusNode); setFocusId(null); }} onClose={() => setFocusId(null)} /> : null}
      {reviewItem && reviewNode ? <CanvasLabReview item={reviewItem} anchorNodeId={reviewNode.id} links={links} profileId={profile?.id} decisions={page?.decisions ?? []} nodes={visibleNodes} comments={comments} onTrailSelect={(group, focus) => noteWorkboardTrailSelected(orgId, group, focus)} onClose={() => setReviewId(null)} /> : null}
    </div>
  );
}
