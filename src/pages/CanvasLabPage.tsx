import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Menu, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { planToolbarOverflow, type ToolbarControlSpec } from "@/lib/toolbar-overflow";

import { BoardAsk } from "@/components/canvas-lab/BoardAsk";
import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { useRegisterAskLasso } from "@/components/reflect/ask-lasso-context";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { LOOP_SIZE_TOOLBAR } from "@/lib/lasso-loop";
import type { KeptAnswer } from "@/components/reflect/answer-keep-context";
import { supabase } from "@/integrations/supabase/client";
import { ANSWER_DRAG_MIME, KEEP_ANSWER_ANNOUNCEMENT, answerCiteRows, answerNodeInput, canKeepAnswer, isAnswerDrag, parseAnswerDrop } from "@/lib/answer-card";

import { CanvasLabReview } from "@/components/canvas-lab/CanvasLabReview";
import { CanvasLabStatusLine } from "@/components/canvas-lab/CanvasLabStatusLine";
import { FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import { FoundationGuide } from "@/components/canvas-lab/FoundationGuide";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabColourBlock } from "@/components/canvas-lab/LabColourBlock";
import { LabSticky, stickyBodyOf } from "@/components/canvas-lab/LabSticky";
import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import { LabFrame as LabFrameElement } from "@/components/canvas-lab/LabFrame";
import { applyMarqueeSelection, cardsInMarquee, isMarqueeClick, marqueeRect, type MarqueeRect } from "@/components/canvas-lab/canvas-lab-marquee";
import { GroupingNamePopup } from "@/components/canvas-lab/GroupingNamePopup";

import { LabLinkRejection } from "@/components/canvas-lab/LabLinkRejection";
import { LabRelationshipOverlays } from "@/components/canvas-lab/LabRelationshipOverlays";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import { LabBundleLinks } from "@/components/canvas-lab/LabBundleLinks";
import { LabBundleControls, LabBundleStackEdges } from "@/components/canvas-lab/LabBundleControls";
import { shouldEndOnMove } from "@/components/canvas-lab/canvas-lab-pointer";
import { RegionColourSwatches } from "@/components/canvas-lab/RegionColourSwatches";
import { LabUndoToast } from "@/components/canvas-lab/LabUndoToast";
import {
  canUndoToastEntry,
  emptyUndoStacks,
  popRedo,
  popUndo,
  recordUndo,
  undoAnnouncement,
  bundleMoveAnnouncement,
  undoKeyIntent,
  type UndoDirection,
  type UndoEntry,
  type UndoEntryDraft,
  type UndoStacks,
} from "@/components/canvas-lab/canvas-lab-undo";
import { ShareDialog } from "@/components/canvas-lab/ShareDialog";
import { ReasoningTrailGuide } from "@/components/canvas-lab/ReasoningTrailGuide";
import {
  addLabLink,
  bringToFront,
  eventKind,
  retryAction,
  cardStackZ,
  connectDisarmed,
  addLocalFrame,
  markFrameSaved,
  keepViewportUnscrolled,
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
  labInverseZoom,
  linkRemovalAnnouncement,
  localNodeAnchor,
  moveNode,
  dragEndDecision,
  nextWorkstreamRect,
  FRAME_MIN_HEIGHT,
  FRAME_MIN_WIDTH,
  panToRevealNode,
  workstreamAddAnchor,
  BOARD_GUIDE_RECTS,
  BOARD_INLINE_ADD_SIZE,
  nearestLabAnchor,
  removeContext,
  removeLabLink,
  relationshipSelection,
  seedCanvas,
  seedBlankCanvas,
  boardHasSeededStructure,
  fitCardRect,
  sizeSeedFrames,
  stageBounds,
  resizeLabRect,
  decorationPointerIntent,
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
  type LabResizeKind,
} from "@/components/canvas-lab/canvas-lab-model";
import {
  noteWorkboardChangeSaved,
  noteWorkboardConflictResolved,
  noteWorkboardElementResized,
  noteWorkboardNodeCreated,
  noteWorkboardCardMenuOpened,
  noteWorkboardNodeDeleted,
  noteWorkboardNodeEdited,
  noteWorkboardOpened,
  noteWorkboardRail,
  noteWorkboardRecordVisibility,
  noteWorkboardRelationship,
  noteWorkboardReviewOpened,
  noteWorkboardSaveFailed,
  noteWorkboardTrailSelected,
  noteWorkboardDropPromptAnswered,
  noteWorkboardStructureToggled,
  noteWorkboardCardContentViewed,
  noteWorkboardExampleViewed,
  noteWorkboardSaveErrorResolved,
  noteWorkboardContextChanged,
  noteWorkboardUndoUsed,
  noteWorkboardBundleToggled,
  noteAnnotationChanged,
  noteHighlightChanged,
  noteWorkboardWorkAdded,
  noteWorkboardWorkstreamDrawn,
  noteWorkboardRegionNamed,
  type LabNodeEventKind,
  type WorkboardOpenVia,
  type WorkboardPersistAction,
  type WorkboardPersistEntity,
} from "@/components/canvas-lab/canvas-lab-telemetry";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { GraphiteIcon } from "@/components/notebook/icons";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { BoardDetailsContent } from "@/components/canvas-lab/BoardDetailsPopover";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DETAILS_SEARCH } from "@/lib/engagement-default-view";
import { useCanvasLab } from "@/hooks/use-canvas-lab";
import { useCanvasLabAnnotations } from "@/hooks/use-canvas-lab-annotations";
import { useCanvasLabComments, useWorkboardCommentCounts } from "@/hooks/use-canvas-lab-comments";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useWorkboardCardPreviews } from "@/hooks/use-workboard-card-previews";
import { useWorkboardFilePreviews } from "@/hooks/use-workboard-file-previews";
import { useMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { dragTo, keyTo, type Point } from "@/lib/canvas-drag";
import { filedWorkCount, groupingDragSnapshot, isRegionFrameId, moveGroupingContents, newRegionFrameId, regionClaimable, regionClaims, regionFillStyle, regionNameChange, regionToolAfterDraw, type GroupingDragMember, type RegionFill } from "@/lib/board-region";
import { isWorkboardDecorationKind, serializeWorkboardStickyBody, serializeWorkboardTextBody, WORKBOARD_STICKY_DEFAULT_SIZE, type WorkboardCommand, type WorkboardNodeInput, type WorkboardRelation, type WorkboardTextBody } from "@/lib/canvas-lab-shared";
import { noteCanvasOpenedFn } from "@/lib/canvas.functions";
import { clampZoom, scrollableUnder, stepZoom, wheelPanVector, workboardPinchZoom, zoomAbout } from "@/lib/canvas-zoom";
import { needsHighlightForComment } from "@/lib/canvas-lab-annotations-shared";
import { engagementDisplayTitle } from "@/lib/clients";
import { isDeliverableType } from "@/lib/lineage-shared";
import type { WorkItemRow } from "@/lib/work-types";
import { useQueryClient } from "@tanstack/react-query";
import { AddWorkPanel, type AddWorkSource } from "@/components/canvas-lab/AddWorkPanel";
import { CARD_HEIGHT, CARD_WIDTH, bundleCountBand, chatBundles, dockBundles, dockedPieceChats, applyBundleViews, bundlePiecesBand, readBundleViews, workboardBundlesKey, writeBundleViews, type BundleView } from "@/components/canvas-lab/canvas-lab-model";
import { placeWorkOnBoardFn } from "@/lib/workboard-add-work.functions";
import { placeAddedCards, placementRectsForFrames, placementRectsForNodes, type PlacementRect } from "@/lib/workboard-placement";
import { briefAttachmentPoints, pendingBriefAttachments } from "@/lib/brief-files";
import { addBriefFiles, removeBriefFile, useBriefFiles, useInvalidateBriefFiles } from "@/hooks/use-brief-files";
import {
  CONTEXT_FRAME_ID,
  CONTEXT_FRAME_LABEL,
  contextExitPoint,
  contextRegionAround,
  overlapsContextRegion,
  contextRegionFor,
  contextRegionRect,
  contextSlots,
  contextAreaAvailability,
  isContextFrameId,
  needsContextRegion,
} from "@/lib/context-region";
import { TRAIL_FRAME_ID, TRAIL_FRAME_LABEL, boardHasTrail, isTrailFrameId, trailRectAt } from "@/lib/reasoning-trail";
import { isBoardDefaultTask, workstreamTasks } from "@/lib/board-default-task";
import { createDrawnWorkstreamFn, moveItemToWorkstreamFn } from "@/lib/workstream-draw.functions";
import { defaultWorkstreamName, drawnRect, drawnRectUsable, movePromptText, splitClaims, type ClaimCandidate, type DrawRect } from "@/lib/workstream-draw";
import { boardIsNearEmpty, readWorkboardStructureMode, workboardStructureModeKey } from "@/lib/workboard-view-mode";
import { ExampleBoardOverlay } from "@/components/canvas-lab/ExampleBoardOverlay";


/** A local workboard over one permission-filtered engagement read. */
export function workboardOpenVia(value: string | undefined): WorkboardOpenVia {
  if (value === "header" || value === "canvas_tab" || value === "default") return value;
  return "direct";
}

function ToolbarIcon({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

export function CanvasLabPage({ engagementId, entryVia }: { engagementId: string; entryVia?: string }) {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: page, isLoading, isError } = useEngagementPage(engagementId);
  const noteOpened = useServerFn(noteCanvasOpenedFn);
  const unfold = useMotion("canvas.unfolded");
  const viewerName = profile?.display_name ?? "You";
  const engagement = page?.engagement ?? null;
  const orgId = profile?.org_id;
  const entryViaRef = useRef(workboardOpenVia(entryVia));
  const entryLoggedRef = useRef(false);
  const lab = useCanvasLab(engagementId, profile?.id, orgId);
  const queryClient = useQueryClient();
  const placeWork = useServerFn(placeWorkOnBoardFn);
  const createDrawnWorkstream = useServerFn(createDrawnWorkstreamFn);
  const moveItemToWorkstream = useServerFn(moveItemToWorkstreamFn);


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
  const selectedRef = useRef<string[]>([]);
  selectedRef.current = selected;
  const [comments] = useState<LabComment[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusOrigin, setFocusOrigin] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  /** A card's chip opens the reader already at the comments. */
  const [focusOpensComments, setFocusOpensComments] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [keyboardId, setKeyboardId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [linkRejection, setLinkRejection] = useState<{ targetId: string; message: string } | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [connectSource, setConnectSource] = useState<{ nodeId: string; anchor: LabAnchor } | null>(null);
  const [connectorPreview, setConnectorPreview] = useState<Point | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [zoom, setZoom] = useState(0.72);
  // R9: Details is a glance popover, not a navigation. It anchors to the
  // toolbar button when that is in the row and to the overflow trigger when
  // the control has collapsed into the menu.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsAnchorRef = useRef<HTMLElement | null>(null);
  const detailsAnchorVirtualRef = useRef({
    getBoundingClientRect: () =>
      detailsAnchorRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0),
  });
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const openDetails = (anchor: HTMLElement) => {
    detailsAnchorRef.current = anchor;
    setDetailsOpen(true);
  };
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
  const dropPromptRef = useRef<{ nodeId: string; frameId: string } | null>(null);
  dropPromptRef.current = dropPrompt;
  /** Every way a move prompt can end, counted once, answer only. */
  const closeDropPrompt = useCallback((answer: "yes" | "keep" | "dismissed") => {
    if (!dropPromptRef.current) return;
    noteWorkboardDropPromptAnswered(orgId, answer);
    dropPromptRef.current = null;
    setDropPrompt(null);
  }, [orgId]);
  const [opening, setOpening] = useState(true);
  /** True once the board's first layout has settled and the opening fit has run. */
  const [boardFitted, setBoardFitted] = useState(false);
  const [interaction, setInteraction] = useState<"idle" | "drag" | "pan" | "resize" | "connect" | "marquee">("idle");
  const [structureMode, setStructureMode] = useState<LabStructureMode>("freeform");
  const [exampleOpen, setExampleOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [front, setFront] = useState<string[]>([]);
  /** The inline workstream name takes the caret as soon as it appears. */
  const inlineNameRef = useCallback((element: HTMLInputElement | null) => { element?.focus({ preventScroll: true }); }, []);
  const [addWorkOpen, setAddWorkOpen] = useState(false);
  const [addWorkVia, setAddWorkVia] = useState<"header" | "context_menu">("header");
  const [addWorkAnchor, setAddWorkAnchor] = useState<Point | null>(null);
  const [addWorkTarget, setAddWorkTarget] = useState<"board" | "context">("board");
  const [addWorkBusy, setAddWorkBusy] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [keepBusy, setKeepBusy] = useState(false);
  const [regionFill, setRegionFill] = useState<RegionFill>("green-faded");
  const [pendingRegionNameId, setPendingRegionNameId] = useState<string | null>(null);
  /** Right-click on empty board space. Screen coords for the menu, board coords for the drop. */
  const [boardMenu, setBoardMenu] = useState<{ screen: Point; board: Point } | null>(null);
  /** B4: the workstream tool, the box being dragged and the name still to be given. */
  const [drawTool, setDrawTool] = useState(false);
  const [drawing, setDrawing] = useState<{ from: Point; to: Point } | null>(null);
  const drawingRef = useRef<{ from: Point; to: Point } | null>(null);
  const [pendingWorkstream, setPendingWorkstream] = useState<{ rect: DrawRect; name: string } | null>(null);
  const [pendingWorkstreamError, setPendingWorkstreamError] = useState(false);
  const [claimPrompt, setClaimPrompt] = useState<{ rect: DrawRect; taskId: string; frameId: string; cards: ClaimCandidate[]; claimed: number } | null>(null);
  const [undoToast, setUndoToast] = useState<{ message: string; entry: UndoEntry } | null>(null);
  const undoRef = useRef<UndoStacks>(emptyUndoStacks());
  const undoIdRef = useRef(0);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; origin: Point; from: Point } | null>(null);
  /** A frame drag snapshots its geometric contents once, before anything moves. */
  const frameDragRef = useRef<{ id: string; origin: Point; from: Point; members: GroupingDragMember[] } | null>(null);
  const connectorDragRef = useRef<{ nodeId: string; anchor: LabAnchor; from: Point; moved: boolean } | null>(null);
  const cardHeightsRef = useRef(new Map<string, number>());
  const resizeRef = useRef<{ kind: LabResizeKind; id: string; corner: LabResizeCorner; start: LabRect; pointer: Point; method: "pointer" | "keyboard" } | null>(null);
  const [pendingJudgmentFocusId, setPendingJudgmentFocusId] = useState<string | null>(null);
  const panRef = useRef<{ from: Point; origin: Point } | null>(null);
  /** B3: the box being dragged out on empty board, in screen and board points. */
  const marqueeRef = useRef<{ fromScreen: Point; fromBoard: Point; toScreen: Point; toBoard: Point } | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [marqueePreview, setMarqueePreview] = useState<string[]>([]);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panStateRef = useRef<Point>(pan);
  panStateRef.current = pan;
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const openedRef = useRef(false);
  const fittedReadyRef = useRef(false);
  const viewportChangedRef = useRef(false);
  const fitInputsRef = useRef<{ frames: LabFrame[]; nodes: LabNode[]; structured: boolean; guides: boolean }>({ frames: [], nodes: [], structured: true, guides: true });
  const observedSizeRef = useRef<{ width: number; height: number } | null>(null);
  const viewedPreviewIdsRef = useRef(new Set<string>());
  /** The deterministic virtual seed a durable board is overlaid onto. */
  const virtualBaseRef = useRef<{ frames: LabFrame[]; nodes: LabNode[] } | null>(null);


  useEffect(() => {
    if (!page?.engagement || nodes !== null || frames !== null || lab.boardLoading) return;
    // The board's default home is not a workstream, so it gets no outline and
    // its work reads as free cards.
    const boardTasks = workstreamTasks(page.tasks ?? []);
    // A board with saved outlines keeps the seeded structure it has always
    // had. A board with none is new, and opens blank.
    const seeded = boardHasSeededStructure(lab.board);
    const initialFrames = seeded ? createLabFrames(boardTasks) : [];
    const seedInput = {
      brief: { title: "The brief", text: page.engagement.brief },
      tasks: boardTasks.map((task) => ({ id: task.id, name: task.name, detail: task.detail, ownedByViewer: task.owner_id === profile?.id })),
      work: workItems.map((item) => ({ id: item.id, title: item.title, typeLabel: item.type.replaceAll("_", " "), source: item.source, ownedByViewer: !item.owner_id || item.owner_id === profile?.id, taskIds: taskIdsByWork.get(item.id) ?? [], deliverable: isDeliverableType(item.type), bundle: item })),
      decisions: (page.decisions ?? []).map((decision) => ({ id: decision.id, call: decision.call_text, situation: decision.situation, ownedByViewer: decision.owner_id === profile?.id })),
    };
    const virtualNodes = seeded ? seedCanvas(seedInput, initialFrames) : seedBlankCanvas(seedInput);
    const virtualFrames = seeded ? sizeSeedFrames(initialFrames, virtualNodes) : [];
    virtualBaseRef.current = { frames: virtualFrames, nodes: virtualNodes };
    undoRef.current = emptyUndoStacks();
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
  const shownNodes = useMemo(() => allNodes.filter((node) => !hiddenIds.includes(node.id)), [allNodes, hiddenIds]);
  /** U2: a pushed chat and the pieces it made, derived from the work items. */
  const bundles = useMemo(() => chatBundles(shownNodes, workItems), [shownNodes, workItems]);
  const pieceChat = useMemo(() => dockedPieceChats(bundles), [bundles]);
  const pieceChatRef = useRef(pieceChat);
  pieceChatRef.current = pieceChat;
  /** B2: per viewer, which chats are minimized or show all their pieces. Restored after mount. */
  const [bundleViews, setBundleViews] = useState<Record<string, BundleView>>({});
  const bundleViewsKey = profile?.id ? workboardBundlesKey(profile.id, engagementId) : null;
  useEffect(() => {
    if (!bundleViewsKey) return;
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { storage = undefined; }
    setBundleViews(readBundleViews(storage, bundleViewsKey));
  }, [bundleViewsKey]);
  const bundleView = useMemo(() => {
    const workItemByNode = new Map(shownNodes.map((node) => [node.id, node.workItemId]));
    return applyBundleViews(bundles, bundleViews, (chatId) => workItemByNode.get(chatId) ?? undefined);
  }, [bundles, bundleViews, shownNodes]);
  /** U3: docked pieces sit below their chat, so every consumer sees one layout. */
  const visibleNodes = useMemo(
    () => dockBundles(bundleView.dropped.size ? shownNodes.filter((node) => !bundleView.dropped.has(node.id)) : shownNodes, bundleView.bundles),
    [shownNodes, bundleView],
  );

  useEffect(() => {
    if (!orgId || entryLoggedRef.current || nodes === null) return;
    entryLoggedRef.current = true;
    noteWorkboardOpened(orgId, entryViaRef.current, bundleCountBand(bundles.size));
  }, [orgId, nodes, bundles]);
  const hiddenNodes = useMemo(() => allNodes.filter((node) => hiddenIds.includes(node.id)), [allNodes, hiddenIds]);
  const boardFrames = useMemo(() => frames ?? [], [frames]);
  const pendingRegionName = useMemo(() => boardFrames.find((frame) => frame.id === pendingRegionNameId && isRegionFrameId(frame.id) && !frame.name) ?? null, [boardFrames, pendingRegionNameId]);
  /** B3: the trail a person put on a blank board, if they have put one there. */
  const trailFrame = useMemo(() => boardFrames.find((frame) => isTrailFrameId(frame.id)) ?? null, [boardFrames]);
  const bounds = useMemo(() => stageBounds(boardFrames, visibleNodes), [boardFrames, visibleNodes]);
  const contextNodes = visibleNodes.filter((node) => selected.includes(node.id));
  const focusNode = visibleNodes.find((node) => node.id === focusId) ?? null;
  const reviewNode = visibleNodes.find((node) => node.id === reviewId) ?? null;
  const itemByNode = (node: LabNode) => node.workItemId ? workItems.find((item) => item.id === node.workItemId) : undefined;
  const focusItem = focusNode ? itemByNode(focusNode) ?? null : null;
  const reviewItem = reviewNode ? itemByNode(reviewNode) ?? null : null;
  const onScreenChatIds = useMemo(() => {
    if (viewportSize.width === 0 || zoom <= 0) return [];
    const left = -pan.x / zoom;
    const top = -pan.y / zoom;
    const right = left + viewportSize.width / zoom;
    const bottom = top + viewportSize.height / zoom;
    return visibleNodes.flatMap((node) => {
      const item = node.workItemId ? workItems.find((entry) => entry.id === node.workItemId) : undefined;
      const height = cardHeightsRef.current.get(node.id) ?? node.height;
      const intersects = node.x < right && node.x + node.width > left && node.y < bottom && node.y + height > top;
      return item?.type === "ai_thread" && intersects ? [item.id] : [];
    });
  }, [pan.x, pan.y, viewportSize.height, viewportSize.width, visibleNodes, workItems, zoom]);
  const onScreenFileItems = useMemo(() => {
    if (viewportSize.width === 0 || zoom <= 0) return [];
    const left = -pan.x / zoom;
    const top = -pan.y / zoom;
    const right = left + viewportSize.width / zoom;
    const bottom = top + viewportSize.height / zoom;
    return visibleNodes.flatMap((node) => {
      const item = node.workItemId ? workItems.find((entry) => entry.id === node.workItemId) : undefined;
      const height = cardHeightsRef.current.get(node.id) ?? node.height;
      const intersects = node.x < right && node.x + node.width > left && node.y < bottom && node.y + height > top;
      return item && item.type !== "ai_thread" && intersects ? [item] : [];
    });
  }, [pan.x, pan.y, viewportSize.height, viewportSize.width, visibleNodes, workItems, zoom]);
  const cardPreviews = useWorkboardCardPreviews(engagementId, profile?.id, true, onScreenChatIds);
  const filePreviews = useWorkboardFilePreviews(profile?.id, true, onScreenFileItems);
  const focusThreadId = focusItem && focusItem.type === "ai_thread" ? focusItem.id : null;
  const annotations = useCanvasLabAnnotations(engagementId, focusThreadId, profile?.id);
  const commentThreads = useCanvasLabComments(engagementId, focusThreadId, profile?.id);
  const commentCounts = useWorkboardCommentCounts(engagementId, profile?.id);
  const canComment = Boolean(lab.board?.canEditStructure);
  /** Bringing work in is arranging the board, so a coach never sees it. */
  const canAddWork = lab.board?.canEditStructure !== false;
  /** The fixed guide panels belong to boards that were seeded with structure. */
  const showGuides = boardHasSeededStructure(lab.board);
  const showExample = boardIsNearEmpty(visibleNodes);
  const loadingBoard = isLoading || lab.boardLoading;
  const notAvailable = !loadingBoard && !isError && !engagement;
  const boardReady = !loadingBoard && !isError && Boolean(engagement) && nodes !== null && frames !== null;
  fitInputsRef.current = { frames: boardFrames, nodes: visibleNodes, structured: structureMode === "structured", guides: showGuides };

  useEffect(() => {
    if (!profile?.id) return;
    try {
      setStructureMode(readWorkboardStructureMode(window.localStorage.getItem(workboardStructureModeKey(profile.id, engagementId))));
    } catch {
      setStructureMode("freeform");
    }
  }, [engagementId, profile?.id]);

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
      inputs.guides ? undefined : null,
    );
    setZoom(result.zoom);
    setPan(result.pan);
  }, [boardReady]);

  /**
   * B5: files that came in with the brief sit in a column beside the brief
   * card, joined to it by one context link. Both steps happen once: a card
   * that already has its link is never moved again, so a person's own
   * arrangement stands.
   */
  const briefFiles = useBriefFiles(engagementId);
  const invalidateBriefFiles = useInvalidateBriefFiles();
  const briefAttachSeenRef = useRef(new Set<string>());
  const briefAttachBusyRef = useRef(false);
  const removedContextRef = useRef<{ id: string; version: number } | null>(null);

  useEffect(() => {
    if (!boardFitted || !nodes || !frames || briefAttachBusyRef.current) return;
    if (!lab.board?.canEditStructure) return;
    const fileIds = (briefFiles.data ?? []).map((entry) => entry.workItemId);
    const ids = fileIds.filter((id) => !briefAttachSeenRef.current.has(id));
    // B2: on a blank board the brief and its documents belong in the context
    // region, so the region is made the first time either one exists.
    const hasContextContent = needsContextRegion({ hasBrief: Boolean(page?.engagement?.brief?.trim()), fileCount: fileIds.length });
    const availability = contextAreaAvailability({
      active: framesRef.current.some((frame) => isContextFrameId(frame.id)),
      archived: Boolean(removedContextRef.current ?? lab.board?.archivedContextFrame),
      hasContent: hasContextContent,
    });
    const wantsRegion = !boardHasSeededStructure(lab.board) && availability.autoCreate;
    const unplaced = wantsRegion && contextMemberNodeIds(fileIds).some((id) => nodesRef.current.find((node) => node.id === id)?.frame !== CONTEXT_FRAME_ID);
    if (ids.length === 0 && !unplaced) return;
    const pending = pendingBriefAttachments(ids, nodesRef.current, linksRef.current);
    for (const id of ids) briefAttachSeenRef.current.add(id);
    briefAttachBusyRef.current = true;
    void (async () => {
      try {
        const region = wantsRegion ? await ensureContextRegion(fileIds) : null;
        if (pending.length === 0) return;
        // The brief's place is read at compute time, and the saved row wins
        // whenever there is one: it is what the canvas draws and the record
        // holds. Outlines are not occupied space, since cards live inside
        // them; only other cards are.
        const liveBrief = nodesRef.current.find((node) => node.id === "brief");
        const savedBrief = (lab.board?.nodes ?? []).find((node) => node.kind === "brief");
        const briefNode = savedBrief
          ? { x: savedBrief.x, y: savedBrief.y, width: savedBrief.w > 0 ? savedBrief.w : (liveBrief?.width ?? 232) }
          : liveBrief;
        const pendingIds = new Set(pending.map((card) => card.nodeId));
        const taken: PlacementRect[] = nodesRef.current
          .filter((node) => !pendingIds.has(node.id) && !hiddenIds.includes(node.id))
          .map((node) => ({ x: node.x, y: node.y, width: node.width, height: node.height }));

        // Inside the region the cards are already placed, so only the link is
        // still owed.
        const points = region || !briefNode ? [] : briefAttachmentPoints(briefNode, taken, pending.length);
        for (const [index, card] of pending.entries()) {
          const at = points[index];
          if (at) {
            nodesRef.current = nodesRef.current.map((node) => node.id === card.nodeId ? { ...node, x: at.x, y: at.y } : node);
            setNodes((current) => current?.map((node) => node.id === card.nodeId ? { ...node, x: at.x, y: at.y } : node) ?? current);
            await persistNodePatch(card.nodeId, { x: at.x, y: at.y });
          }
          const result = addLabLink(linksRef.current, "brief", "right", card.nodeId, "left");
          if (result.error) continue;
          const created = result.links[result.links.length - 1];
          if (!created) continue;
          const link: LabLink = { ...created, relation: "context" };
          linksRef.current = [...linksRef.current, link];
          setLinks((current) => current.some((entry) => entry.id === link.id) ? current : [...current, link]);
          await persistLink(link);
        }
      } finally {
        briefAttachBusyRef.current = false;
      }
    })();
  }, [boardFitted, briefFiles.data, frames, hiddenIds, lab.board, nodes, page?.engagement?.brief]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !boardReady) return;
    const size = { width: shell.clientWidth, height: shell.clientHeight };
    setViewportSize(size);
    if (!fittedReadyRef.current) {
      fittedReadyRef.current = true;
      observedSizeRef.current = size;
      fit();
      setBoardFitted(true);
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const next = entry
        ? { width: entry.contentRect.width, height: entry.contentRect.height }
        : { width: shell.clientWidth, height: shell.clientHeight };
      if (!viewportSizeChanged(observedSizeRef.current, next)) return;
      observedSizeRef.current = next;
      setViewportSize(next);
      if (!viewportChangedRef.current) fit();
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [boardReady]);

  /** The viewer's own outline choice for this board, remembered locally. */
  function rememberStructureMode(mode: LabStructureMode) {
    if (!profile?.id) return;
    try {
      window.localStorage.setItem(workboardStructureModeKey(profile.id, engagementId), mode);
    } catch {
      /* private mode: the choice just does not persist */
    }
  }

  function openExample() {
    setExampleOpen(true);
    noteWorkboardExampleViewed(orgId, "header");
  }

  function notePreviewScroll(item: WorkItemRow, kind: "chat" | "document" | "deck" | "html" | "mermaid") {
    if (viewedPreviewIdsRef.current.has(item.id)) return;
    viewedPreviewIdsRef.current.add(item.id);
    noteWorkboardCardContentViewed(orgId, kind);
  }

  /* ---------------- Phase 3: durable save pipeline ---------------- */
  const nodesRef = useRef<LabNode[]>([]);
  nodesRef.current = allNodes;
  const framesRef = useRef<LabFrame[]>([]);
  framesRef.current = boardFrames;
  const hiddenRef = useRef<string[]>([]);
  hiddenRef.current = hiddenIds;
  const boardIdRef = useRef<string | null>(null);
  boardIdRef.current = lab.board?.id ? lab.board.id : null;
  const linksRef = useRef<LabLink[]>([]);
  linksRef.current = links;
  /** Coaches read the board, so nothing they do lands on an undo stack. */
  const canArrangeRef = useRef(true);
  canArrangeRef.current = lab.board?.canEditStructure !== false;

  /** Put one arranging step on the stack. A new step clears the redo side. */
  function record(entry: UndoEntryDraft): UndoEntry | null {
    if (!canArrangeRef.current) return null;
    undoIdRef.current += 1;
    undoRef.current = recordUndo(undoRef.current, { ...entry, id: `undo-${undoIdRef.current}` } as UndoEntry);
    return undoRef.current.undo[undoRef.current.undo.length - 1] ?? null;
  }

  function frameKindOf(frame: LabFrame): "foundation" | "task" | "decisions" | "outputs" | "custom" | "context" {
    if (isContextFrameId(frame.id)) return "context";
    if (frame.id === "foundation" || frame.id === "decisions" || frame.id === "outputs") return frame.id;
    return frame.id.startsWith("task:") ? "task" : "custom";
  }

  useRegisterAskLasso(() => setAskOpen(true));
  // Ask Lasso is the board's one side panel and opens by default on desktop.
  useEffect(() => { if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) setAskOpen(true); }, []);

  function nodeToInput(node: LabNode): WorkboardNodeInput | null {
    const base = { clientKey: node.clientKey ?? node.id, frameKey: node.frame ?? null, x: node.x, y: node.y, w: node.width, h: node.height, hidden: hiddenRef.current.includes(node.id) };
    if (node.kind === "work" && node.workItemId) return { ...base, kind: "work_item", workItemId: node.workItemId };
    if (node.kind === "decision" && node.id.startsWith("decision:")) return { ...base, kind: "decision", decisionId: node.id.slice(9) };
    if (node.kind === "brief") return { ...base, kind: "brief" };
    if (node.kind === "judgment" && node.local) return { ...base, kind: "judgment", title: node.title, body: node.summary, judgmentType: node.judgmentType ?? null };
    if (node.kind === "shape" && node.colour) return { ...base, frameKey: null, kind: "shape", body: node.colour };
    if (node.kind === "text") return { ...base, frameKey: null, kind: "text", body: serializeWorkboardTextBody({ text: node.summary, size: node.textSize ?? "label", weight: node.textWeight ?? "medium", colour: node.textColour ?? "ink" }) };
    if (node.kind === "sticky") return { ...base, frameKey: null, kind: "sticky", body: serializeWorkboardStickyBody(stickyBodyOf(node)) };
    if (node.kind === "answer") return { ...base, kind: "answer", title: node.title, body: node.summary };
    return null;
  }


  function report(result: { status: string }, entity: WorkboardPersistEntity, action: WorkboardPersistAction): void {
    if (result.status === "saved") noteWorkboardChangeSaved(orgId, entity, action);
    else if (result.status === "conflict") noteWorkboardSaveFailed(orgId, entity, "conflict");
    else if (result.status === "forbidden") noteWorkboardSaveFailed(orgId, entity, "permission");
    else if (result.status === "network_error") noteWorkboardSaveFailed(orgId, entity, "network");
    else if (result.status === "validation_error") noteWorkboardSaveFailed(orgId, entity, "validation");
    else noteWorkboardSaveFailed(orgId, entity, "unknown");
  }

  async function materialize(): Promise<boolean> {
    if (boardIdRef.current) return true;
    const frameInputs = framesRef.current.map((frame, index) => ({
      key: frame.id,
      kind: frameKindOf(frame),
      taskId: frame.id.startsWith("task:") ? frame.id.slice(5) : null,
      label: isRegionFrameId(frame.id) ? (frame.name || null) : frameKindOf(frame) === "custom" ? frame.name : frameKindOf(frame) === "context" ? CONTEXT_FRAME_LABEL : null,
      fill: frame.fill ?? null,
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
    setFrames((current) => current?.map((frame) => { const durableId = frameMap[frame.id]; return durableId ? { ...frame, durableId, durableVersion: 1, local: false } : frame; }) ?? current);
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

  async function persistFramePatch(localId: string, patch: { x?: number; y?: number; w?: number; h?: number; label?: string | null; taskId?: string | null }) {
    if (!(await materialize())) return;
    const frame = framesRef.current.find((entry) => entry.id === localId);
    if (!frame?.durableId) {
      // F1: a region with no durable row behind it used to swallow every
      // change. The person hears about it instead.
      setAnnouncement("That grouping is not saved yet, so this change did not save.");
      return;
    }
    const result = await lab.persist({ type: "frame_update", frameId: frame.durableId, expectedVersion: frame.durableVersion ?? 1, patch });
    report(result, "frame", "update");
    if (result.status === "saved") setFrames((current) => current?.map((entry) => entry.id === localId ? { ...entry, durableVersion: result.versions[frame.durableId ?? ""] ?? (frame.durableVersion ?? 1) + 1 } : entry) ?? current);
  }

  async function persistLink(link: LabLink) {
    const from = await ensureNodeDurable(link.fromId);
    const to = await ensureNodeDurable(link.toId);
    if (!from || !to) return;
    const result = await lab.persist({ type: "link_create", fromNodeId: from.id, fromAnchor: link.fromAnchor, toNodeId: to.id, toAnchor: link.toAnchor, relation: link.relation ?? "context" });
    report(result, "relationship", "create");
    if (result.status === "saved" && result.created?.linkId) {
      const id = result.created.linkId;
      const version = result.versions[id] ?? 1;
      setLinks((current) => current.map((entry) => entry.id === link.id ? { ...entry, durableId: id, durableVersion: version, relation: entry.relation ?? "context" } : entry));
    }
  }

  /** A link is saved before its meaning is chosen, so wait for its durable id. */
  async function linkDurable(localId: string): Promise<LabLink | null> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const live = linksRef.current.find((entry) => entry.id === localId);
      if (live?.durableId) return live;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  /** Change what one link means, and say so on the stack. */
  function changeRelation(localId: string, relation: WorkboardRelation, options?: { silent?: boolean }) {
    const current = linksRef.current.find((entry) => entry.id === localId);
    if (!current) return;
    const before = current.relation ?? "context";
    if (before === relation) return;
    setLinks((links) => links.map((entry) => entry.id === localId ? { ...entry, relation } : entry));
    if (!options?.silent) {
      record({ action: "link_relation", linkId: localId, before, after: relation });
      noteWorkboardRelationship(orgId, "relation_changed", relation);
      setAnnouncement(`This link now means ${relation}.`);
    }
    void (async () => {
      const durable = await linkDurable(localId);
      if (!durable?.durableId) return;
      const result = await lab.persist({ type: "link_update", linkId: durable.durableId, expectedVersion: durable.durableVersion ?? 1, relation });
      report(result, "relationship", "update");
      if (result.status === "saved") {
        const nextVersion = result.versions[durable.durableId] ?? (durable.durableVersion ?? 1) + 1;
        setLinks((links) => links.map((entry) => entry.id === localId ? { ...entry, durableVersion: nextVersion } : entry));
      }
    })();
  }

  async function persistLinkRemoval(link: LabLink) {
    if (!link.durableId) return;
    const result = await lab.persist({ type: "link_archive", linkId: link.durableId, expectedVersion: link.durableVersion ?? 1 });
    report(result, "relationship", "archive");
  }

  /* ---------------- 2c-v: one step back ---------------- */

  /** Whatever the board holds right now, never the version stored on a stack. */
  function liveNode(id: string, fallback?: LabNode): LabNode | undefined {
    return nodesRef.current.find((entry) => entry.id === id) ?? fallback;
  }

  function setNodeHidden(id: string, hidden: boolean, point: { x: number; y: number } | null) {
    setHiddenIds((current) => hidden ? (current.includes(id) ? current : [...current, id]) : current.filter((entry) => entry !== id));
    if (point) setNodes((current) => current?.map((entry) => entry.id === id ? { ...entry, ...point } : entry) ?? current);
    void persistNodePatch(id, point ? { hidden, x: point.x, y: point.y } : { hidden });
  }

  function applyFrameMove(nodeId: string, frameId: string | null) {
    void (async () => {
      if (!(await materialize())) return;
      const durableTarget = frameId === null ? null : framesRef.current.find((frame) => frame.id === frameId)?.durableId;
      setNodes((current) => current?.map((entry) => entry.id === nodeId ? { ...entry, frame: frameId } : entry) ?? current);
      // Letting a card go is a board placement, never a change to what fed it.
      if (frameId === null) await persistNodePatch(nodeId, { frameId: null });
      else if (durableTarget) await persistNodePatch(nodeId, { frameId: durableTarget });
    })();
  }

  /** Apply one stack entry, either backwards or forwards. No action events. */
  function applyUndoEntry(entry: UndoEntry, direction: UndoDirection): void {
    if (entry.action === "move") {
      const to = direction === "undo" ? entry.before : entry.after;
      setNodes((current) => current ? moveNode(current, entry.nodeId, to) : current);
      void persistNodePatch(entry.nodeId, { x: to.x, y: to.y });
      return;
    }
    if (entry.action === "resize") {
      const rect = direction === "undo" ? entry.before : entry.after;
      if (entry.kind === "card") {
        setNodes((current) => current?.map((node) => node.id === entry.targetId ? { ...node, ...rect } : node) ?? current);
        void persistNodePatch(entry.targetId, { x: rect.x, y: rect.y, w: rect.width, h: rect.height });
      } else {
        setFrames((current) => current?.map((frame) => frame.id === entry.targetId ? { ...frame, ...rect } : frame) ?? current);
        void persistFramePatch(entry.targetId, { x: rect.x, y: rect.y, w: rect.width, h: rect.height });
      }
      return;
    }
    if (entry.action === "hide") {
      setNodeHidden(entry.nodeId, direction === "redo", null);
      return;
    }
    if (entry.action === "restore") {
      if (direction === "undo") setNodeHidden(entry.nodeId, true, entry.before);
      else setNodeHidden(entry.nodeId, false, entry.after);
      return;
    }
    if (entry.action === "remove_note") {
      const stored = entry.node;
      if (direction === "undo") {
        setNodes((current) => current && !current.some((node) => node.id === stored.id) ? [...current, stored] : current);
        setLinks((current) => [...current, ...entry.links.filter((link) => !current.some((existing) => existing.id === link.id))]);
        if (stored.durableId) {
          const version = liveNode(stored.id, stored)?.durableVersion ?? stored.durableVersion ?? 1;
          void lab.persist({ type: "node_restore", nodeId: stored.durableId, expectedVersion: version }).then((result) => report(result, "node", "restore"));
        }
        return;
      }
      if (stored.durableId) {
        const version = liveNode(stored.id, stored)?.durableVersion ?? stored.durableVersion ?? 1;
        void lab.persist({ type: "node_archive", nodeId: stored.durableId, expectedVersion: version }).then((result) => report(result, "node", "archive"));
      }
      setNodes((current) => {
        if (!current) return current;
        const result = deleteLocalNode(current, linksRef.current, selected, stored.id);
        setLinks(result.links);
        setSelected(result.selected);
        return result.nodes;
      });
      return;
    }
    if (entry.action === "relationship_add" || entry.action === "relationship_remove") {
      const removing = entry.action === "relationship_add" ? direction === "undo" : direction === "redo";
      const live = linksRef.current.find((link) => link.id === entry.link.id) ?? entry.link;
      if (removing) {
        void persistLinkRemoval(live);
        setLinks((current) => removeLabLink(current, live.id));
        setSelectedLinkId((current) => relationshipSelection(current, "deselect"));
        return;
      }
      const result = addLabLink(linksRef.current, entry.link.fromId, entry.link.fromAnchor, entry.link.toId, entry.link.toAnchor);
      if (result.error) return;
      setLinks(result.links);
      const created = result.links[result.links.length - 1];
      if (created) void persistLink(created);
      return;
    }
    if (entry.action === "link_relation") {
      changeRelation(entry.linkId, (direction === "undo" ? entry.before : entry.after) as WorkboardRelation, { silent: true });
      return;
    }
    if (entry.action === "bundle_workstream_move") {
      // One step: every node in the bundle goes back, or forward, together.
      for (const move of entry.moves) applyFrameMove(move.nodeId, direction === "undo" ? move.before : move.after);
      return;
    }
    applyFrameMove(entry.nodeId, direction === "undo" ? entry.before : entry.after);
  }

  /** Take one step back or put one step forward, and say which. */
  function runUndo(direction: UndoDirection): boolean {
    const popped = direction === "undo" ? popUndo(undoRef.current) : popRedo(undoRef.current);
    if (!popped.entry) {
      setAnnouncement(direction === "undo" ? "Nothing to undo." : "Nothing to redo.");
      return false;
    }
    undoRef.current = popped.stacks;
    setUndoToast(null);
    applyUndoEntry(popped.entry, direction);
    noteWorkboardUndoUsed(orgId, popped.entry.action, direction);
    if (popped.entry.action === "bundle_workstream_move") {
      const entry = popped.entry;
      const target = direction === "undo" ? entry.moves[0]?.before : entry.moves[0]?.after;
      const name = framesRef.current.find((frame) => frame.id === target)?.name ?? "no workstream";
      setAnnouncement(bundleMoveAnnouncement(entry.chatTitle, entry.moves.length - 1, name));
    } else setAnnouncement(undoAnnouncement(popped.entry.action, direction));
    return true;
  }

  /** The toast only speaks for the step it was raised about. */
  function undoFromToast(entry: UndoEntry) {
    if (canUndoToastEntry(undoRef.current, entry.id)) runUndo("undo");
    setUndoToast(null);
  }

  /**
   * Load latest reads the whole durable board again and re-applies it over the
   * deterministic seed, so workstreams, cards and relationships all reconcile.
   * Viewport, rail, selection and unsent composer text are left alone.
   */
  /** One reload path, shared by Load latest and Discard. */
  async function reloadDurableBoard(): Promise<boolean> {
    const fresh = await lab.refresh();
    const base = virtualBaseRef.current;
    if (!fresh?.id || !base) {
      lab.clearSaveState();
      return false;
    }
    const merged = applyDurableBoard(base, fresh);
    const localOnly = (nodesRef.current ?? []).filter((entry) => !entry.durableId && (entry.kind === "chat" || (entry.local && entry.kind !== "judgment")));
    setFrames(merged.frames);
    setNodes([...merged.nodes, ...localOnly]);
    setLinks(merged.links);
    setHiddenIds(merged.hiddenIds);
    setSelectedLinkId(null);
    undoRef.current = emptyUndoStacks();
    setUndoToast(null);
    lab.clearSaveState();
    return true;
  }

  /** Retry the exact failed change, or go back to the last saved version. */
  function resolveSaveError(choice: "retry" | "discard") {
    const state = lab.saveState;
    if (state.status !== "error") return;
    noteWorkboardSaveErrorResolved(orgId, state.entityKind, choice);
    if (choice === "retry") {
      const retry = state.retry;
      const entity = state.entityKind;
      lab.clearSaveState();
      void lab.persist(retry).then((result) => report(result, entity, retryAction(retry)));
      setAnnouncement("Retried your change.");
      return;
    }
    void (async () => {
      const reloaded = await reloadDurableBoard();
      setAnnouncement(reloaded ? "Went back to the last saved version." : "Nothing was saved yet.");
    })();
  }

  function resolveConflict(choice: "latest" | "retry") {
    const state = lab.saveState;
    if (state.status !== "conflict") return;
    noteWorkboardConflictResolved(orgId, state.entityKind === "link" ? "relationship" : state.entityKind, choice);
    if (choice === "latest") {
      void (async () => {
        await reloadDurableBoard();
        setAnnouncement("Loaded the newer version of this workboard.");
      })();
      return;
    }
    const retry = { ...state.retry, expectedVersion: state.latestVersion } as WorkboardCommand;
    lab.clearSaveState();
    void lab.persist(retry).then((result) => report(result, state.entityKind === "link" ? "relationship" : state.entityKind, retryAction(retry)));
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

  /** B4: the box follows the pointer while the tool is on. */
  const isDrawing = drawing !== null;
  useEffect(() => {
    if (!isDrawing) return;
    function move(event: PointerEvent) {
      const current = drawingRef.current;
      if (shouldEndOnMove(event.buttons, current !== null)) { endDrawing(); return; }
      if (!current) return;
      const next = { from: current.from, to: stagePoint(event.clientX, event.clientY) };
      drawingRef.current = next;
      setDrawing(next);
    }
    function endDrawing() {
      const current = drawingRef.current;
      drawingRef.current = null;
      setDrawing(null);
      if (!current) return;
      const rect = drawnRect(current.from, current.to);
      if (!drawnRectUsable(rect)) { setAnnouncement("Drag a bigger box to draw a grouping."); return; }
      void createPaintRegion(rect);
    }
    function cancelDrawing() {
      drawingRef.current = null;
      setDrawing(null);
    }
    function onVisibility() { if (document.visibilityState === "hidden") cancelDrawing(); }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endDrawing);
    window.addEventListener("pointercancel", endDrawing);
    window.addEventListener("blur", cancelDrawing);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", endDrawing);
      window.removeEventListener("pointercancel", endDrawing);
      window.removeEventListener("blur", cancelDrawing);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isDrawing, pan.x, pan.y, zoom]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (drawTool || pendingWorkstream || drawingRef.current) { cancelDraw(); setAnnouncement("Workstream drawing cancelled."); return; }
        if (selectedLinkId) setSelectedLinkId((current) => relationshipSelection(current, "deselect"));
        if (dropPrompt) { closeDropPrompt("dismissed"); return; }
        const resize = resizeRef.current;
        if (resize) {
          if (resize.kind !== "frame") setNodes((current) => current?.map((node) => node.id === resize.id ? { ...node, ...resize.start } : node) ?? current);
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
        else if (selectedLinkId) setSelectedLinkId((current) => relationshipSelection(current, "deselect"));
        else if (selectedRef.current.length > 0 && shellRef.current?.contains(document.activeElement)) {
          // B3: Escape on the board clears the context selection.
          setSelected([]);
          noteWorkboardContextChanged(orgId, "cleared");
          setAnnouncement("Cleared context.");
        }
        return;
      }
      if (cardMenuOpen) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (selectedLinkId) {
        event.preventDefault();
        const link = links.find((entry) => entry.id === selectedLinkId);
        if (link) removeRelationship(link);
        return;
      }
      if (!keyboardId) return;
      const node = allNodes.find((entry) => entry.id === keyboardId);
      if (!node) return;
      if (!node.local && node.kind !== "chat" && !isWorkboardDecorationKind(node.kind)) {
        event.preventDefault();
        const hint = "Real work is removed from the board, not deleted. Use Remove from board.";
        setLinkRejection({ targetId: node.id, message: hint });
        setAnnouncement(hint);
        return;
      }
      event.preventDefault();
      deleteNode(node);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allNodes, cardMenuOpen, closeDropPrompt, connectSource, dropPrompt, focusId, keyboardId, menuOpen, orgId, reviewId, selectedLinkId]);

  /** Cmd or Ctrl with Z and Y, unless the keys belong to a text field. */
  useEffect(() => {
    function onUndoKey(event: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      const direction = undoKeyIntent(event, Boolean(active?.closest("textarea,input,[contenteditable='true']")));
      if (!direction) return;
      if (cardMenuOpen || menuOpen || focusId || reviewId) return;
      event.preventDefault();
      runUndo(direction);
    }
    window.addEventListener("keydown", onUndoKey, { passive: false });
    return () => window.removeEventListener("keydown", onUndoKey);
  }, [cardMenuOpen, focusId, menuOpen, orgId, reviewId]);

  useEffect(() => {
    if (!dropPrompt) return;
    function close(event: PointerEvent) {
      if ((event.target as Element | null)?.closest("[data-drop-prompt='true']")) return;
      closeDropPrompt("dismissed");
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [closeDropPrompt, dropPrompt, drawTool, pendingWorkstream]);

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

  /** Screen point inside the board surface to a point on the board itself. */
  const boardPointFromScreen = useCallback((screen: Point): Point => {
    const z = zoomRef.current || 1;
    const at = panStateRef.current;
    return { x: (screen.x - at.x) / z, y: (screen.y - at.y) / z };
  }, []);

  /** The brief and the documents that came in with it. */
  function contextMemberNodeIds(fileIds: string[]): string[] {
    const ids: string[] = [];
    const brief = nodesRef.current.find((node) => node.id === "brief");
    if (brief) ids.push(brief.id);
    for (const fileId of fileIds) {
      const node = nodesRef.current.find((entry) => entry.workItemId === fileId);
      if (node && !ids.includes(node.id)) ids.push(node.id);
    }
    return ids;
  }

  function nodeRect(node: LabNode): PlacementRect {
    return { x: node.x, y: node.y, width: node.width, height: node.height };
  }

  function insideRegion(node: LabNode, rect: PlacementRect): boolean {
    return node.x >= rect.x && node.y >= rect.y && node.x + node.width <= rect.x + rect.width && node.y + node.height <= rect.y + rect.height;
  }

  /**
   * B2: the context region, made the first time a blank board has a brief or a
   * document. It is an ordinary outline, so it moves and resizes like the
   * rest, and it is never a workstream.
   */
  async function ensureContextRegion(fileIds: string[]): Promise<LabFrame | null> {
    if (boardHasSeededStructure(lab.board)) return null;
    if (removedContextRef.current || lab.board?.archivedContextFrame) return null;
    if (!needsContextRegion({ hasBrief: Boolean(page?.engagement?.brief?.trim()), fileCount: fileIds.length })) return null;
    const memberIds = contextMemberNodeIds(fileIds);
    if (memberIds.length === 0) return null;
    let frame = framesRef.current.find((entry) => isContextFrameId(entry.id)) ?? null;
    if (!frame) {
      const brief = nodesRef.current.find((node) => node.id === "brief");
      // The region is drawn around the brief where it already stands, so
      // making it moves nothing.
      const rect = brief ? contextRegionAround(brief, memberIds.length) : contextRegionRect({ x: 0, y: 0 }, memberIds.length);
      const created: LabFrame = { id: CONTEXT_FRAME_ID, name: CONTEXT_FRAME_LABEL, x: rect.x, y: rect.y, width: rect.width, height: rect.height, local: true };
      framesRef.current = [...framesRef.current, created];
      setFrames((current) => (current ? [...current, created] : current));
      const boardExisted = boardIdRef.current != null;
      if (!(await materialize())) return null;
      if (boardExisted) {
        const result = await lab.persist({ type: "frame_create", frame: { key: created.id, kind: "context", taskId: null, label: CONTEXT_FRAME_LABEL, x: created.x, y: created.y, w: created.width, h: created.height, ord: 0 } });
        report(result, "frame", "create");
        if (result.status === "saved" && result.created?.frameId) {
          const id = result.created.frameId;
          const version = result.versions[id] ?? 1;
          setFrames((current) => (current ? markFrameSaved(current, created.id, id, version) : current));
          framesRef.current = markFrameSaved(framesRef.current, created.id, id, version);
        }
      }
      frame = framesRef.current.find((entry) => isContextFrameId(entry.id)) ?? created;
    }
    await clearRegionOfStrangers(frame, memberIds);
    await placeInContext(frame, memberIds);
    return framesRef.current.find((entry) => isContextFrameId(entry.id)) ?? frame;
  }

  /**
   * The packed flow on a blank board starts at the origin, so an unrelated
   * card can be sitting where the region is drawn. Those cards move clear of
   * it, below the region, so the outline only ever encloses the brief and the
   * documents that came with it.
   */
  async function clearRegionOfStrangers(frame: LabFrame, memberIds: string[]) {
    const rect = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    const strangers = nodesRef.current.filter((node) => !memberIds.includes(node.id) && node.frame !== CONTEXT_FRAME_ID && overlapsContextRegion(rect, nodeRect(node)));
    if (strangers.length === 0) return;
    const taken: PlacementRect[] = [rect, ...nodesRef.current.filter((node) => !strangers.some((stranger) => stranger.id === node.id)).map(nodeRect)];
    for (const node of strangers) {
      const at = contextExitPoint(rect, taken);
      taken.push({ x: at.x, y: at.y, width: node.width, height: node.height });
      nodesRef.current = nodesRef.current.map((entry) => entry.id === node.id ? { ...entry, x: at.x, y: at.y } : entry);
      setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, x: at.x, y: at.y } : entry) ?? current);
      await persistNodePatch(node.id, { x: at.x, y: at.y });
    }
  }


  /** Cards already inside the region keep their place; the rest take a free slot. */
  async function placeInContext(frame: LabFrame, nodeIds: string[]) {
    const rect: PlacementRect = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    const framePatch = frame.durableId ? { frameId: frame.durableId } : {};
    const settled = nodesRef.current.filter((node) => node.frame === CONTEXT_FRAME_ID || (nodeIds.includes(node.id) && insideRegion(node, rect)));
    const occupied = settled.map(nodeRect);
    const moving = nodeIds.filter((id) => !settled.some((node) => node.id === id));
    const slots = contextSlots(rect, occupied, moving.length);
    const held = [...occupied];
    for (const [index, id] of moving.entries()) {
      const at = slots[index];
      if (!at) continue;
      nodesRef.current = nodesRef.current.map((node) => node.id === id ? { ...node, x: at.x, y: at.y, frame: CONTEXT_FRAME_ID } : node);
      setNodes((current) => current?.map((node) => node.id === id ? { ...node, x: at.x, y: at.y, frame: CONTEXT_FRAME_ID } : node) ?? current);
      held.push({ x: at.x, y: at.y, width: CARD_WIDTH, height: CARD_HEIGHT });
      await persistNodePatch(id, { x: at.x, y: at.y, ...framePatch });
    }
    for (const node of settled) {
      if (node.frame === CONTEXT_FRAME_ID) continue;
      nodesRef.current = nodesRef.current.map((entry) => entry.id === node.id ? { ...entry, frame: CONTEXT_FRAME_ID } : entry);
      setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, frame: CONTEXT_FRAME_ID } : entry) ?? current);
      if (frame.durableId) await persistNodePatch(node.id, framePatch);
    }
    const grown = contextRegionFor(rect, held);
    if (grown.width !== rect.width || grown.height !== rect.height) {
      framesRef.current = framesRef.current.map((entry) => entry.id === frame.id ? { ...entry, width: grown.width, height: grown.height } : entry);
      setFrames((current) => current?.map((entry) => entry.id === frame.id ? { ...entry, width: grown.width, height: grown.height } : entry) ?? current);
      await persistFramePatch(frame.id, { w: grown.width, h: grown.height });
    }
  }

  /**
   * Taking a document out of context leaves it on the board. It is not hiding
   * the card, and it is not deleting the work.
   */
  async function takeOutOfContext(node: LabNode) {
    const frame = framesRef.current.find((entry) => isContextFrameId(entry.id));
    if (!node.workItemId || !frame) return;
    try {
      await removeBriefFile(engagementId, node.workItemId);
    } catch {
      setAnnouncement("That document could not be taken out of context.");
      return;
    }
    briefAttachSeenRef.current.add(node.workItemId);
    const taken = nodesRef.current
      .filter((entry) => entry.id !== node.id && !hiddenRef.current.includes(entry.id))
      .map(nodeRect);
    const at = contextExitPoint({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }, taken);
    nodesRef.current = nodesRef.current.map((entry) => entry.id === node.id ? { ...entry, x: at.x, y: at.y, frame: null } : entry);
    setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, x: at.x, y: at.y, frame: null } : entry) ?? current);
    await persistNodePatch(node.id, { x: at.x, y: at.y, frameId: null });
    await invalidateBriefFiles();
    noteWorkboardChangeSaved(orgId, "context_doc", "removed");
    setAnnouncement(`${node.title} taken out of context. It is still on the board.`);
  }

  function openAddWork(via: "header" | "context_menu", anchor: Point | null, target: "board" | "context" = "board") {
    setAddWorkVia(via);
    setAddWorkAnchor(anchor);
    setAddWorkTarget(target);
    setAddWorkOpen(true);
  }

  /**
   * Work chosen, uploaded or brought in from a connected app lands here. The
   * placement is a plain row per item, so nothing already on the board moves
   * and nothing already placed is written twice.
   */
  async function addWorkToBoard(ids: string[], source: AddWorkSource) {
    if (ids.length === 0 || addWorkBusy) return;
    setAddWorkBusy(true);
    try {
      const result = await placeWork({
        data: { engagement_id: engagementId, work_item_ids: ids, profile_id: profile?.id },
      });
      const known = new Set((nodesRef.current ?? []).flatMap((node) => (node.workItemId ? [node.workItemId] : [])));
      const fresh = result.items.filter((item) => !known.has(item.id));
      if (fresh.length > 0) {
        const anchor = addWorkAnchor ?? boardPointFromScreen(viewportCentre());
        // Outlines count as occupied even while "Show workstreams" is off: a
        // loose card never lands inside an outline it cannot see.
        // Guides and the inline add control hold board space of their own, so
        // they count as taken alongside cards and outlines. Their bounds come
        // from the constants that position them, never from the screen.
        const inlineAnchor = structureMode === "structured" && Boolean(lab.board?.canEditStructure) && !boardFrames.some((frame) => frame.id === "workstreams")
          ? workstreamAddAnchor(boardFrames, visibleNodes)
          : null;
        const taken: PlacementRect[] = [
          ...placementRectsForNodes(visibleNodes),
          ...placementRectsForFrames(boardFrames.map((frame) => ({ id: frame.id, label: frame.name, x: frame.x, y: frame.y, width: frame.width, height: frame.height }))),
          ...(showGuides ? BOARD_GUIDE_RECTS.map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })) : []),
          ...(inlineAnchor ? [{ x: inlineAnchor.x, y: inlineAnchor.y, ...BOARD_INLINE_ADD_SIZE }] : []),
        ];
        const points = placeAddedCards(anchor, taken, fresh.length);
        const added: LabNode[] = fresh.map((item, index) => {
          const at = points[index] ?? anchor;
          return {
            id: `work:${item.id}`,
            kind: "work",
            frame: showGuides ? "foundation" : null,
            title: item.title,
            summary: item.source,
            typeLabel: item.type.replaceAll("_", " "),
            ownership: !item.owner_id || item.owner_id === profile?.id ? "yours" : "teammate",
            workItemId: item.id,
            deliverable: isDeliverableType(item.type),
            x: at.x,
            y: at.y,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          } satisfies LabNode;
        });
        // The live board gains the new cards in place: nothing already on it is
        // moved, reset or re-seeded.
        nodesRef.current = [...nodesRef.current, ...added];
        setNodes((current) => [...(current ?? []), ...added]);
        const base = virtualBaseRef.current;
        if (base) virtualBaseRef.current = { frames: base.frames, nodes: [...base.nodes, ...added] };
        for (const node of added) await ensureNodeDurable(node.id);
      }
      if (addWorkTarget === "context" && profile?.id) {
        try {
          await addBriefFiles({ engagementId, workItemIds: ids, profileId: profile.id });
          for (const id of ids) briefAttachSeenRef.current.delete(id);
          await invalidateBriefFiles();
          const fileIds = [...new Set([...(briefFiles.data ?? []).map((entry) => entry.workItemId), ...ids])];
          await ensureContextRegion(fileIds);
          noteWorkboardChangeSaved(orgId, "context_doc", "added");
        } catch {
          setAnnouncement("Those documents came onto the board but not into context.");
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      await queryClient.invalidateQueries({ queryKey: ["engagement"] });
      noteWorkboardWorkAdded(orgId, source, addWorkVia, ids.length);
      setAddWorkOpen(false);
    } catch {
      setAnnouncement("That work could not be added here.");
    } finally {
      setAddWorkBusy(false);
    }
  }

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
      zoomTo(workboardPinchZoom(zoomRef.current, event.deltaY, event.deltaMode), pointIn(event));
    }
    function onSurfaceWheel(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea,input,[contenteditable='true'],[role='menu'],[data-radix-popper-content-wrapper]")) return;
      const delta = wheelPanVector(event);
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

  function onCardPointerDown(picked: LabNode, event: React.PointerEvent) {
    // A docked piece is carried by its chat: the drag moves the chat.
    const node = bundleChatFor(picked);
    if (spaceRef.current) return; // Space pans the board, even over a card.
    if (event.button !== 0 || (event.target as Element).closest("button,textarea")) return;
    event.stopPropagation();
    closeDropPrompt("dismissed");
    setSelectedLinkId((current) => relationshipSelection(current, "deselect"));
    setKeyboardId(picked.id);
    setSelectedFrameId(null);
    setInteraction("drag");
    dragRef.current = { id: node.id, origin: { x: node.x, y: node.y }, from: { x: event.clientX, y: event.clientY } };
  }

  useEffect(() => {
    function interactionLive() {
      return Boolean(connectorDragRef.current || resizeRef.current?.method === "pointer" || frameDragRef.current || dragRef.current || panRef.current || marqueeRef.current);
    }
    function move(event: PointerEvent) {
      if (shouldEndOnMove(event.buttons, interactionLive())) { endInteraction(event); return; }
      const box = marqueeRef.current;
      if (box) {
        box.toScreen = { x: event.clientX, y: event.clientY };
        box.toBoard = stagePoint(event.clientX, event.clientY);
        setMarquee(marqueeRect(box.fromBoard, box.toBoard));
        setMarqueePreview(cardsInMarquee(marqueeRect(box.fromBoard, box.toBoard), visibleNodes, cardHeightsRef.current));
        return;
      }
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
        if (resizing.kind !== "frame") setNodes((current) => current?.map((node) => node.id === resizing.id ? { ...node, ...rect } : node) ?? current);
        else setFrames((current) => current?.map((frame) => frame.id === resizing.id ? { ...frame, ...containFrameMembers(rect, frame.id, nodesRef.current) } : frame) ?? current);
        return;
      }
      const trailDrag = frameDragRef.current;
      if (trailDrag) {
        const to = dragTo(trailDrag.origin, { x: (event.clientX - trailDrag.from.x) / zoom, y: (event.clientY - trailDrag.from.y) / zoom });
        setFrames((current) => current?.map((frame) => frame.id === trailDrag.id ? { ...frame, x: to.x, y: to.y } : frame) ?? current);
        if (trailDrag.members.length > 0) setNodes((current) => current ? moveGroupingContents(current, trailDrag.members, to) : current);
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
    /** B1: the one end path for drag, trail drag, resize, connector and pan. */
    function endInteraction(event: { clientX: number; clientY: number; shiftKey?: boolean }) {
      const box = marqueeRef.current;
      marqueeRef.current = null;
      setMarqueePreview([]);
      if (box) {
        // B3: a box selects every card it touches as context; a tiny box is a click.
        setMarquee(null);
        setInteraction("idle");
        shellRef.current?.classList.remove("select-none");
        const toScreen = { x: event.clientX, y: event.clientY };
        if (isMarqueeClick(marqueeRect(box.fromScreen, toScreen))) {
          if (selectedRef.current.length > 0) {
            setSelected([]);
            noteWorkboardContextChanged(orgId, "cleared");
          }
          return;
        }
        const ids = cardsInMarquee(marqueeRect(box.fromBoard, stagePoint(event.clientX, event.clientY)), visibleNodes, cardHeightsRef.current);
        const next = applyMarqueeSelection(selectedRef.current, ids, Boolean(event.shiftKey));
        setSelected(next);
        noteWorkboardContextChanged(orgId, "marquee");
        setAnnouncement(`${next.length} ${next.length === 1 ? "card" : "cards"} in context`);
        return;
      }
      const trailDrag = frameDragRef.current;
      frameDragRef.current = null;
      if (trailDrag) {
        const to = dragTo(trailDrag.origin, { x: (event.clientX - trailDrag.from.x) / zoom, y: (event.clientY - trailDrag.from.y) / zoom });
        if (to.x !== trailDrag.origin.x || to.y !== trailDrag.origin.y) {
          framesRef.current = framesRef.current.map((frame) => frame.id === trailDrag.id ? { ...frame, x: to.x, y: to.y } : frame);
          nodesRef.current = moveGroupingContents(nodesRef.current, trailDrag.members, to);
          setFrames((current) => current?.map((frame) => frame.id === trailDrag.id ? { ...frame, x: to.x, y: to.y } : frame) ?? current);
          setNodes((current) => current ? moveGroupingContents(current, trailDrag.members, to) : current);
          void (async () => {
            await persistFramePatch(trailDrag.id, { x: to.x, y: to.y });
            for (const member of trailDrag.members) {
              const moved = nodesRef.current.find((node) => node.id === member.id);
              if (moved) await persistNodePatch(moved.id, { x: moved.x, y: moved.y });
            }
          })();
        }
        setInteraction("idle");
        return;
      }
      const connector = connectorDragRef.current;
      if (connector?.moved) finishPointerConnect(connector, event);
      connectorDragRef.current = null;
      setConnectorPreview(null);
      const drag = resizeRef.current?.method === "pointer" ? null : dragRef.current;
      if (drag) {
        const moved = nodesRef.current.find((node) => node.id === drag.id);
        if (moved) {
          const decision = dragEndDecision({
            origin: drag.origin,
            from: drag.from,
            pointer: { x: event.clientX, y: event.clientY },
            zoom,
            node: moved,
            frames: framesRef.current,
            mode: structureMode,
            editable: Boolean(lab.board?.canEditStructure) && (moved.kind !== "judgment" || Boolean(moved.local)),
          });
          if (decision.position) {
            const landed = decision.position;
            setNodes((current) => current ? moveNode(current, drag.id, landed) : current);
            void persistNodePatch(drag.id, { x: landed.x, y: landed.y });
            record({ action: "move", nodeId: drag.id, before: drag.origin, after: landed });
            const target = decision.promptFrameId ? framesRef.current.find((frame) => frame.id === decision.promptFrameId) : null;
            if (target) {
              setDropPrompt({ nodeId: moved.id, frameId: target.id });
              setAnnouncement(`Move to ${target.name}?`);
            }
          }
        }
      }
      dragRef.current = null;
      const resizing = resizeRef.current;
      if (resizing?.method === "pointer") {
        const rect = resizeLabRect(resizing.start, resizing.corner, { x: (event.clientX - resizing.pointer.x) / zoom, y: (event.clientY - resizing.pointer.y) / zoom }, Boolean(event.shiftKey), resizing.kind);
        const changed = rect.x !== resizing.start.x || rect.y !== resizing.start.y || rect.width !== resizing.start.width || rect.height !== resizing.start.height;
        if (resizing.kind !== "frame") {
          if (changed) {
            setNodes((current) => current?.map((node) => node.id === resizing.id ? { ...node, ...rect } : node) ?? current);
            void persistNodePatch(resizing.id, { x: rect.x, y: rect.y, w: rect.width, h: rect.height });
            noteWorkboardElementResized(orgId, resizing.kind, "pointer", resizeAxis(resizing.start, rect));
            record({ action: "resize", kind: "card", targetId: resizing.id, before: resizing.start, after: rect });
          }
        } else if (changed) {
          const contained = containFrameMembers(rect, resizing.id, nodesRef.current);
          setFrames((current) => current?.map((frame) => frame.id === resizing.id ? { ...frame, ...contained } : frame) ?? current);
          void persistFramePatch(resizing.id, { x: contained.x, y: contained.y, w: contained.width, h: contained.height });
          noteWorkboardElementResized(orgId, "frame", "pointer", resizeAxis(resizing.start, contained));
          record({ action: "resize", kind: "frame", targetId: resizing.id, before: resizing.start, after: contained });
        }
        resizeRef.current = null;
      }
      panRef.current = null;
      setInteraction("idle");
    }
    const lastPointer = { clientX: 0, clientY: 0 };
    function track(event: PointerEvent) { lastPointer.clientX = event.clientX; lastPointer.clientY = event.clientY; }
    function onMove(event: PointerEvent) { track(event); move(event); }
    function onUp(event: PointerEvent) { endInteraction(event); }
    function onBlur() { if (interactionLive()) endInteraction(lastPointer); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [lab.board?.canEditStructure, links, orgId, structureMode, visibleNodes, zoom]);

  /**
   * F1: a move or a resize made a moment before leaving the page is written
   * out rather than lost. The card or region is read where it now stands and
   * sent on, and the interaction is closed so nothing writes it twice.
   */
  useEffect(() => {
    function flush() {
      const drag = dragRef.current;
      const resizing = resizeRef.current;
      const trailDrag = frameDragRef.current;
      dragRef.current = null;
      resizeRef.current = null;
      frameDragRef.current = null;
      panRef.current = null;
      marqueeRef.current = null;
      setMarquee(null);
      shellRef.current?.classList.remove("select-none");
      connectorDragRef.current = null;
      setConnectorPreview(null);
      setInteraction("idle");
      const nodeId = drag?.id ?? (resizing?.kind !== "frame" ? resizing?.id ?? null : null);
      if (nodeId) {
        const node = nodesRef.current.find((entry) => entry.id === nodeId);
        if (node) void persistNodePatch(node.id, { x: node.x, y: node.y, w: node.width, h: node.height });
      }
      const frameId = trailDrag?.id ?? (resizing?.kind === "frame" ? resizing.id : null);
      if (frameId) {
        const frame = framesRef.current.find((entry) => entry.id === frameId);
        if (frame) void persistFramePatch(frame.id, { x: frame.x, y: frame.y, w: frame.width, h: frame.height });
      }
      if (trailDrag) {
        for (const member of trailDrag.members) {
          const node = nodesRef.current.find((entry) => entry.id === member.id);
          if (node) void persistNodePatch(node.id, { x: node.x, y: node.y });
        }
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);


  /** The chat a docked piece belongs to, read from the stored board; else the node itself. */
  function bundleChatFor(node: LabNode): LabNode {
    const chatId = pieceChatRef.current.get(node.id);
    return (chatId ? nodesRef.current.find((entry) => entry.id === chatId) : undefined) ?? node;
  }

  function onCardKeyDown(picked: LabNode, event: React.KeyboardEvent) {
    const node = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) ? bundleChatFor(picked) : picked;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected((current) => {
        const adding = !current.includes(node.id);
        setAnnouncement(adding ? "Added to context" : "Removed from context");
        return toggleContext(current, node.id);
      });
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const to = keyTo({ x: node.x, y: node.y }, event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", event.shiftKey);
      setNodes((current) => current ? moveNode(current, node.id, to) : current);
      void persistNodePatch(node.id, { x: to.x, y: to.y });
      record({ action: "move", nodeId: node.id, before: { x: node.x, y: node.y }, after: to, coalesceKey: `nudge:${node.id}` });
    }
  }

  function startResize(kind: LabResizeKind, id: string, corner: LabResizeCorner, rect: LabRect, event: React.PointerEvent<HTMLButtonElement>) {
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

  function keyboardResize(kind: LabResizeKind, id: string, corner: LabResizeCorner, rect: LabRect, event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    event.stopPropagation();
    const amount = event.shiftKey ? 24 : 8;
    const delta = { x: event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0, y: event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0 };
    if (!resizeRef.current) resizeRef.current = { kind, id, corner, start: rect, pointer: { x: 0, y: 0 }, method: "keyboard" };
    setInteraction("resize");
    const resized = resizeLabRect(rect, corner, delta, event.shiftKey, kind);
    const next = kind === "frame" ? containFrameMembers(resized, id, nodesRef.current) : resized;
    if (kind !== "frame") setNodes((current) => current?.map((node) => node.id === id ? { ...node, ...next } : node) ?? current);
    else setFrames((current) => current?.map((frame) => frame.id === id ? { ...frame, ...next } : frame) ?? current);
  }

  function finishKeyboardResize(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!event.key.startsWith("Arrow")) return;
    const resizing = resizeRef.current;
    if (!resizing || resizing.method !== "keyboard") return;
    let end: LabRect | null = null;
    if (resizing.kind !== "frame") {
      const node = nodesRef.current.find((entry) => entry.id === resizing.id);
      if (node) { end = { x: node.x, y: node.y, width: node.width, height: node.height }; void persistNodePatch(node.id, { x: node.x, y: node.y, w: node.width, h: node.height }); }
    } else {
      const frame = framesRef.current.find((entry) => entry.id === resizing.id);
      if (frame) { end = { x: frame.x, y: frame.y, width: frame.width, height: frame.height }; void persistFramePatch(frame.id, { x: frame.x, y: frame.y, w: frame.width, h: frame.height }); }
    }
    if (end) {
      noteWorkboardElementResized(orgId, resizing.kind, "keyboard", resizeAxis(resizing.start, end));
      record({ action: "resize", kind: resizing.kind === "frame" ? "frame" : "card", targetId: resizing.id, before: resizing.start, after: end });
    }
    resizeRef.current = null;
    setInteraction("idle");
  }

  function fitCard(node: LabNode) {
    const fitted = fitCardRect(node, cardHeightsRef.current.get(node.id) ?? node.height);
    if (node.width === fitted.width && node.height === fitted.height) return;
    setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, ...fitted } : entry) ?? current);
    void persistNodePatch(node.id, { w: fitted.width, h: fitted.height });
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
    if (isRegionFrameId(frame.id)) { void changeRegionName(frame, name); return; }
    setFrames((current) => current?.map((entry) => entry.id === frame.id ? { ...entry, name } : entry) ?? current);
    if (frame.durableId) void persistFramePatch(frame.id, { label: name });
  }

  /** A drawn region, saved as paint: no name, no task, claiming nothing. */
  async function createPaintRegion(rect: DrawRect) {
    const nextTool = regionToolAfterDraw(regionFill);
    const id = newRegionFrameId(crypto.randomUUID());
    const frame: LabFrame = {
      id,
      name: "",
      fill: nextTool.fill,
      x: rect.x,
      y: rect.y,
      width: Math.max(FRAME_MIN_WIDTH, rect.width),
      height: Math.max(FRAME_MIN_HEIGHT, rect.height),
      local: true,
    };
    setFrames((current) => (current ? [...current, frame] : [frame]));
    framesRef.current = [...framesRef.current, frame];
    setDrawTool(nextTool.armed);
    setSelectedFrameId(id);
    setPendingRegionNameId(id);
    const boardExisted = boardIdRef.current != null;
    if (!(await materialize())) return;
    if (boardExisted) {
      const result = await lab.persist({ type: "frame_create", frame: { key: id, kind: "custom", taskId: null, label: null, fill: nextTool.fill, x: frame.x, y: frame.y, w: frame.width, h: frame.height, ord: 0 } });
      report(result, "frame", "create");
      if (result.status === "saved" && result.created?.frameId) {
        const durableId = result.created.frameId;
        const version = result.versions[durableId] ?? 1;
        setFrames((current) => (current ? markFrameSaved(current, id, durableId, version) : current));
        framesRef.current = markFrameSaved(framesRef.current, id, durableId, version);
      }
    }
    setAnnouncement("Grouping drawn. Name it to make it a workstream.");
  }

  /**
   * W3: naming a region makes it a workstream and takes in the cards inside
   * it. Clearing the name turns it back into paint and lets those cards go.
   */
  async function changeRegionName(frame: LabFrame, nameInput: string) {
    const rect = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    const namedFrameIds = framesRef.current.filter((entry) => isRegionFrameId(entry.id) && entry.name.trim()).map((entry) => entry.id);
    const change = regionNameChange({ id: frame.id, label: frame.name, fill: frame.fill }, nameInput, rect, claimCandidates(), { defaultHomeFrameIds, namedFrameIds });
    if (change.becomes === "paint") {
      // What the name held is measured in filed work, never in covered cards.
      const released = claimCandidates().filter((entry) => entry.frame === frame.id);
      setFrames((current) => current?.map((entry) => (entry.id === frame.id ? { ...entry, name: "" } : entry)) ?? current);
      framesRef.current = framesRef.current.map((entry) => (entry.id === frame.id ? { ...entry, name: "" } : entry));
      for (const cardId of change.release) applyFrameMove(cardId, null);
      if (frame.durableId) await persistFramePatch(frame.id, { label: null, taskId: null });
      noteWorkboardRegionNamed(orgId, "cleared", filedWorkCount(released), frame.fill);
      setAnnouncement("Name taken off. This is a coloured grouping again.");
      return;
    }
    const name = nameInput.trim();
    setFrames((current) => current?.map((entry) => (entry.id === frame.id ? { ...entry, name } : entry)) ?? current);
    framesRef.current = framesRef.current.map((entry) => (entry.id === frame.id ? { ...entry, name } : entry));
    let created: { id: string };
    try {
      created = await createDrawnWorkstream({ data: { engagement_id: engagementId, name, profile_id: profile?.id } });
    } catch {
      setFrames((current) => current?.map((entry) => (entry.id === frame.id ? { ...entry, name: frame.name } : entry)) ?? current);
      framesRef.current = framesRef.current.map((entry) => (entry.id === frame.id ? { ...entry, name: frame.name } : entry));
      setAnnouncement("That name could not be saved. Nothing moved.");
      return;
    }
    if (frame.durableId) await persistFramePatch(frame.id, { label: name, taskId: created.id });
    const split = regionClaims({ id: frame.id, label: name }, rect, claimCandidates(), { defaultHomeFrameIds, namedFrameIds });
    // What naming filed is measured in work items that moved, one each, never
    // in the cards the rectangle happens to cover.
    const filed = new Set<string>();
    let refused = false;
    for (const card of split.silent) {
      const ok = await claimCard(card, created.id, frame.id);
      if (ok) { if (card.workItemId) filed.add(card.workItemId); }
      else refused = true;
    }
    for (const card of split.frameOnly) applyFrameMove(card.id, frame.id);
    const claimed = filed.size;
    if (refused) setAnnouncement("Some cards stayed where they were.");
    if (split.ask.length > 0) {
      setClaimPrompt({ rect, taskId: created.id, frameId: frame.id, cards: split.ask, claimed });
      noteWorkboardRegionNamed(orgId, "named", claimed, frame.fill);
      return;
    }
    noteWorkboardRegionNamed(orgId, "named", claimed, frame.fill);
    if (!refused) setAnnouncement(`${name} now holds ${claimed} cards.`);
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

  async function removeContextArea(frame: LabFrame) {
    if (!frame.durableId) return;
    const result = await lab.persist({ type: "frame_archive", frameId: frame.durableId, expectedVersion: frame.durableVersion ?? 1 });
    report(result, "context_area", "removed");
    if (result.status !== "saved") return;
    removedContextRef.current = { id: frame.durableId, version: result.versions[frame.durableId] ?? (frame.durableVersion ?? 1) + 1 };
    framesRef.current = framesRef.current.filter((entry) => entry.id !== frame.id);
    setFrames((entries) => entries?.filter((entry) => entry.id !== frame.id) ?? entries);
    nodesRef.current = nodesRef.current.map((node) => node.frame === frame.id ? { ...node, frame: null } : node);
    setNodes((entries) => entries?.map((node) => node.frame === frame.id ? { ...node, frame: null } : node) ?? entries);
    setSelectedFrameId(null);
    setAnnouncement("Context area removed. Every card is still on the board.");
  }

  async function addContextArea(at: Point) {
    if (framesRef.current.some((frame) => isContextFrameId(frame.id))) return;
    const fileIds = (briefFiles.data ?? []).map((entry) => entry.workItemId);
    const memberIds = contextMemberNodeIds(fileIds);
    const rect = contextRegionRect(at, memberIds.length);
    const archived = removedContextRef.current ?? lab.board?.archivedContextFrame;
    let created: LabFrame = { id: CONTEXT_FRAME_ID, name: CONTEXT_FRAME_LABEL, x: rect.x, y: rect.y, width: rect.width, height: rect.height, local: true };
    if (archived) {
      const result = await lab.persist({ type: "frame_restore", frameId: archived.id, expectedVersion: archived.version, patch: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
      report(result, "context_area", "created");
      if (result.status !== "saved") return;
      created = { ...created, durableId: archived.id, durableVersion: result.versions[archived.id] ?? archived.version + 1, local: false };
    } else {
      const boardExisted = boardIdRef.current != null;
      framesRef.current = [...framesRef.current, created];
      if (!(await materialize())) { framesRef.current = framesRef.current.filter((frame) => frame.id !== created.id); return; }
      if (boardExisted) {
        const result = await lab.persist({ type: "frame_create", frame: { key: created.id, kind: "context", taskId: null, label: CONTEXT_FRAME_LABEL, x: rect.x, y: rect.y, w: rect.width, h: rect.height, ord: 0 } });
        report(result, "context_area", "created");
        if (result.status !== "saved" || !result.created?.frameId) { framesRef.current = framesRef.current.filter((frame) => frame.id !== created.id); return; }
        created = { ...created, durableId: result.created.frameId, durableVersion: result.versions[result.created.frameId] ?? 1, local: false };
      } else {
        const fresh = await lab.refresh();
        const durable = fresh?.frames.find((frame) => frame.key === CONTEXT_FRAME_ID);
        if (!durable) { framesRef.current = framesRef.current.filter((frame) => frame.id !== created.id); return; }
        created = { ...created, durableId: durable.id, durableVersion: durable.version, local: false };
        noteWorkboardChangeSaved(orgId, "context_area", "created");
      }
    }
    removedContextRef.current = null;
    framesRef.current = [...framesRef.current.filter((frame) => !isContextFrameId(frame.id)), created];
    setFrames((entries) => [...(entries ?? []).filter((frame) => !isContextFrameId(frame.id)), created]);
    await clearRegionOfStrangers(created, memberIds);
    await placeInContext(created, memberIds);
    setAnnouncement("Context area added.");
  }

  /**
   * Keep a finished answer as a card. The card holds the answer in the words
   * it was written in, and stored references to the turns it read. The person
   * who asked is the author of the record.
   */
  async function keepAnswerAsCard(answer: KeptAnswer, options?: { at?: Point; via?: "button" | "drag" }) {
    if (!canKeepAnswer({ onBoard: true, finished: true, canEdit: canAddWork }) || keepBusy) return;
    setKeepBusy(true);
    try {
      if (!(await materialize())) return;
      let at: Point;
      if (options?.at) {
        // A drop places the card's top-left exactly where it was let go.
        at = options.at;
      } else {
        const anchor = boardPointFromScreen(viewportCentre());
        const taken: PlacementRect[] = [
          ...placementRectsForNodes(visibleNodes),
          ...placementRectsForFrames(boardFrames.map((frame) => ({ id: frame.id, label: frame.name, x: frame.x, y: frame.y, width: frame.width, height: frame.height }))),
        ];
        at = placeAddedCards(anchor, taken, 1)[0] ?? anchor;
      }
      const input = answerNodeInput({ clientKey: `answer:${crypto.randomUUID()}`, at, text: answer.text });
      const result = await lab.persist({ type: "node_create", node: input });
      report(result, "node", "create");
      if (result.status !== "saved" || !result.created?.nodeId) return;
      const nodeId = result.created.nodeId;
      noteWorkboardNodeCreated(orgId, "answer", undefined, options?.via);
      const cites = answerCiteRows(nodeId, answer.reads);
      if (cites.length > 0) await supabase.from("answer_cites").insert(cites);
      // Re-read the saved board and apply it, so the kept card is on the stage
      // straight away rather than only after the page is opened again.
      await reloadDurableBoard();

      setAnnouncement(KEEP_ANSWER_ANNOUNCEMENT);
    } finally {
      setKeepBusy(false);
    }
  }

  /** B2: a person's own click or menu choice. Restoring a saved view never comes through here. */
  function toggleBundle(chat: LabNode, state: BundleView, via: "control" | "menu") {
    const key = chat.workItemId;
    const pieces = bundles.get(chat.id)?.length ?? 0;
    if (!key || pieces === 0) return;
    setBundleViews((current) => {
      const next = { ...current };
      if (state === "expanded") delete next[key];
      else next[key] = state;
      let storage: Storage | undefined;
      try { storage = window.localStorage; } catch { storage = undefined; }
      if (bundleViewsKey) writeBundleViews(storage, bundleViewsKey, next);
      return next;
    });
    noteWorkboardBundleToggled(orgId, state, bundlePiecesBand(pieces), via);
  }

  function moveToFrame(node: LabNode, frameId: string) {
    const target = framesRef.current.find((frame) => frame.id === frameId);
    if (!target || node.frame === frameId) return;
    // Pass B1: a chat with docked pieces carries them into the workstream, as one step.
    const pieceIds = bundles.get(node.id) ?? [];
    if (pieceIds.length > 0) {
      const moves = [node, ...pieceIds.map((id) => shownNodes.find((entry) => entry.id === id)).filter((entry): entry is LabNode => Boolean(entry))]
        .map((entry) => ({ nodeId: entry.id, before: entry.frame ?? "", after: frameId }));
      record({ action: "bundle_workstream_move", chatTitle: node.title, moves });
      for (const move of moves) applyFrameMove(move.nodeId, frameId);
      setAnnouncement(bundleMoveAnnouncement(node.title, moves.length - 1, target.name));
      return;
    }
    record({ action: "workstream_move", nodeId: node.id, before: node.frame ?? "", after: frameId });
    applyFrameMove(node.id, frameId);
    setAnnouncement(`${node.title} moved to ${target.name}.`);
  }

  function addNode(kind: LabTemplateKind, judgment?: LabJudgmentType) {
    const frameId = kind === "decision" ? "decisions" : kind === "deliverable" ? "outputs" : kind === "source" ? "foundation" : boardFrames.find((frame) => frame.id.startsWith("task:"))?.id ?? "foundation";
    const named = boardFrames.find((entry) => entry.id === frameId) ?? null;
    // On a blank board there is no step outline to hold the card, so it is laid
    // out beside the trail and belongs to no outline at all.
    const anchorFrame = named ?? trailFrame ?? boardFrames[0];
    if (!anchorFrame) return;
    const built = createLocalNode(kind, anchorFrame, visibleNodes, judgment);
    const node = named ? built : { ...built, frame: null };
    setNodes((current) => current ? [...current, node] : current);
    noteWorkboardNodeCreated(orgId, kind === "judgment" ? "human_judgment" : kind, judgment);
    if (kind === "judgment") {
      const shell = shellRef.current;
      if (shell) setPan((current) => panToRevealNode(current, zoomRef.current, node, { width: shell.clientWidth, height: shell.clientHeight }));
      setKeyboardId(node.id);
      setSelectedFrameId(null);
      setPendingJudgmentFocusId(node.id);
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
    setAnnouncement(node.kind === "shape" ? "Colour block removed." : node.kind === "text" ? "Text block removed." : node.kind === "sticky" ? "Sticky removed." : `${node.title} removed from this workboard.`);
    const entry = record({ action: "remove_note", node, links: links.filter((link) => link.fromId === node.id || link.toId === node.id) });
    if (entry) setUndoToast({ message: "Note removed", entry });
  }


  function hideNode(node: LabNode) {
    setHiddenIds((current) => [...current, node.id]);
    void persistNodePatch(node.id, { hidden: true });
    setSelected((current) => removeContext(current, node.id));
    setKeyboardId(null);
    noteWorkboardRecordVisibility(orgId, "hidden", node.kind === "decision" ? "decision" : node.kind === "brief" ? "brief" : "work");
    setAnnouncement(`${node.title} removed from this local workboard.`);
    const entry = record({ action: "hide", nodeId: node.id });
    if (entry) setUndoToast({ message: node.workItemId ? "Removed from the board. It's still in your inbox." : "Removed from the board", entry });
  }

  /** B3: every card in a workstream or region becomes the context. Membership first, the region's area when it has none. */
  function useFrameAsContext(frame: LabFrame) {
    const members = visibleNodes.filter((node) => node.frame === frame.id && node.kind !== "answer" && !isWorkboardDecorationKind(node.kind)).map((node) => node.id);
    const ids = members.length > 0 ? members : cardsInMarquee({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }, visibleNodes, cardHeightsRef.current);
    setSelected(ids);
    noteWorkboardContextChanged(orgId, "workstream");
    setAnnouncement(`${ids.length} ${ids.length === 1 ? "card" : "cards"} in context`);
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
    record({ action: "restore", nodeId: id, before: { x: node.x, y: node.y }, after: point });
  }

  function stagePoint(clientX: number, clientY: number): Point {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - panStateRef.current.x) / zoomRef.current, y: (clientY - rect.top - panStateRef.current.y) / zoomRef.current };
  }

  function createConnection(sourceId: string, sourceAnchor: LabAnchor, targetId: string, targetAnchor: LabAnchor) {
    const result = addLabLink(links, sourceId, sourceAnchor, targetId, targetAnchor);
    if (result.error) {
      noteWorkboardRelationship(orgId, "rejected");
      setAnnouncement(result.error);
      setLinkRejection({ targetId, message: result.error });
      const disarmed = connectDisarmed();
      setConnectSource(disarmed.connectSource);
      setInteraction(disarmed.interaction);
      return;
    }
    setLinks(result.links);
    setLinkRejection(null);
    const disarmed = connectDisarmed();
    setConnectSource(disarmed.connectSource);
    setInteraction(disarmed.interaction);
    const created = result.links[result.links.length - 1];
    noteWorkboardRelationship(orgId, "created", created?.relation ?? "context");
    if (created) { void persistLink(created); record({ action: "relationship_add", link: created }); }
    setAnnouncement("Relationship saved to the workboard.");
  }

  function removeRelationship(link: LabLink) {
    void persistLinkRemoval(link);
    setLinks((current) => removeLabLink(current, link.id));
    setSelectedLinkId((current) => relationshipSelection(current, "deselect"));
    noteWorkboardRelationship(orgId, "removed");
    setAnnouncement(linkRemovalAnnouncement(link));
    record({ action: "relationship_remove", link });
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

  function finishPointerConnect(source: { nodeId: string; anchor: LabAnchor }, event: { clientX: number; clientY: number }) {
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

  function openNode(node: LabNode, origin?: DOMRect) {
    const item = itemByNode(node);
    setFocusOrigin(origin ? { left: origin.left, top: origin.top, width: origin.width, height: origin.height } : null);
    const openedPreview = item ? filePreviews[item.id] : undefined;
    if (item && openedPreview && openedPreview.kind !== "fallback" && (item.type === "document" || item.type === "deck" || item.type === "sheet") && !viewedPreviewIdsRef.current.has(item.id)) {
      viewedPreviewIdsRef.current.add(item.id);
      noteWorkboardCardContentViewed(orgId, openedPreview.kind === "html" ? "html" : openedPreview.kind === "mermaid" ? "mermaid" : item.type === "deck" ? "deck" : "document", "open");
    }
    if (item && isDeliverableType(item.type)) {
      setReviewId(node.id);
      noteWorkboardReviewOpened(orgId, item.type === "ai_thread" ? "thread" : item.type as "document" | "deck" | "sheet");
    } else setFocusId(node.id);
  }

  /* ---------------- B4: draw a workstream ---------------- */

  /** Cards sitting in the hidden board home count as having no workstream. */
  const defaultHomeFrameIds = useMemo(
    () => (page?.tasks ?? []).filter(isBoardDefaultTask).map((task) => `task:${task.id}`),
    [page?.tasks],
  );

  function claimCandidates(): ClaimCandidate[] {
    return visibleNodes.filter((node) => regionClaimable(node.kind)).map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      frame: node.frame,
      workItemId: node.workItemId ?? null,
    }));
  }

  function cancelDraw() {
    drawingRef.current = null;
    setDrawing(null);
    setDrawTool(false);
    setPendingWorkstream(null);
    setPendingWorkstreamError(false);
  }

  function toggleDrawTool() {
    if (drawTool || pendingWorkstream) {
      cancelDraw();
      setAnnouncement("Grouping drawing off.");
      return;
    }
    if (structureMode !== "structured") {
      setStructureMode("structured");
      rememberStructureMode("structured");
      noteWorkboardStructureToggled(orgId, "structured");
    }
    setDrawTool(true);
    setAnnouncement("Drag on empty board space to draw a grouping.");
  }

  /** The outline is saved the same way every other outline is. */
  async function persistDrawnFrame(frame: LabFrame, taskId: string) {
    const boardExisted = boardIdRef.current != null;
    if (!(await materialize())) return;
    if (!boardExisted) return;
    const result = await lab.persist({ type: "frame_create", frame: { key: frame.id, kind: "task", taskId, label: frame.name, x: frame.x, y: frame.y, w: frame.width, h: frame.height, ord: 0 } });
    report(result, "frame", "create");
    if (result.status === "saved" && result.created?.frameId) {
      const id = result.created.frameId;
      const version = result.versions[id] ?? 1;
      setFrames((current) => current ? markFrameSaved(current, frame.id, id, version) : current);
      framesRef.current = markFrameSaved(framesRef.current, frame.id, id, version);
    }
  }

  /**
   * One card into the new workstream. The outline only takes the card once the
   * placement is agreed, so the board never shows a claim the database refused.
   */
  async function claimCard(card: ClaimCandidate, taskId: string, frameId: string): Promise<boolean> {
    if (card.workItemId) {
      try {
        const result = await moveItemToWorkstream({ data: { item_id: card.workItemId, task_id: taskId, profile_id: profile?.id } });
        if (result.status === "refused") return false;
      } catch {
        return false;
      }
    }
    applyFrameMove(card.id, frameId);
    return true;
  }

  async function commitDrawnWorkstream(nameInput: string) {
    const pending = pendingWorkstream;
    if (!pending) return;
    const name = nameInput.trim();
    if (!name || name.length > 60) { setPendingWorkstreamError(true); return; }
    setPendingWorkstream(null);
    setPendingWorkstreamError(false);
    setDrawTool(false);
    const split = splitClaims(pending.rect, claimCandidates(), { defaultHomeFrameIds });
    let created: { id: string };
    try {
      created = await createDrawnWorkstream({ data: { engagement_id: engagementId, name, profile_id: profile?.id } });
    } catch {
      setAnnouncement("That workstream could not be created. Nothing moved.");
      return;
    }
    const taskId = created.id;
    const frameId = `task:${taskId}`;
    const frame: LabFrame = {
      id: frameId,
      name,
      x: pending.rect.x,
      y: pending.rect.y,
      width: Math.max(FRAME_MIN_WIDTH, pending.rect.width),
      height: Math.max(FRAME_MIN_HEIGHT, pending.rect.height),
      local: true,
    };
    setFrames((current) => current ? [...current, frame] : [frame]);
    framesRef.current = [...framesRef.current, frame];
    await persistDrawnFrame(frame, taskId);
    let claimed = 0;
    let refused = false;
    for (const card of split.silent) {
      const ok = await claimCard(card, taskId, frameId);
      if (ok) claimed += 1;
      else refused = true;
    }
    for (const card of split.frameOnly) {
      applyFrameMove(card.id, frameId);
      claimed += 1;
    }
    if (refused) setAnnouncement("Some cards stayed where they were.");
    if (split.ask.length > 0) {
      setClaimPrompt({ rect: pending.rect, taskId, frameId, cards: split.ask, claimed });
      return;
    }
    noteWorkboardWorkstreamDrawn(orgId, claimed, "false");
    if (!refused) setAnnouncement(`${name} drawn with ${claimed} cards.`);
  }

  async function answerClaimPrompt(answer: "yes" | "keep") {
    const prompt = claimPrompt;
    if (!prompt) return;
    setClaimPrompt(null);
    noteWorkboardDropPromptAnswered(orgId, answer);
    let claimed = prompt.claimed;
    let refused = false;
    if (answer === "yes") {
      for (const card of prompt.cards) {
        const ok = await claimCard(card, prompt.taskId, prompt.frameId);
        if (ok) claimed += 1;
        else refused = true;
      }
    }
    noteWorkboardWorkstreamDrawn(orgId, claimed, "true");
    setAnnouncement(refused ? "Some cards stayed where they were." : answer === "yes" ? `${claimed} cards in this workstream.` : "Those cards stayed where they were.");
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
        setFrames((current) => current ? markFrameSaved(current, frame.id, id, result.versions[id] ?? 1) : current);
      }
    })();
    return true;
  }

  /**
   * B3: a person puts the reasoning trail on a blank board, where they asked
   * for it. It is one outline row, so its place is durable, but it is never a
   * workstream and never the context region.
   */
  async function addTrail(at: Point) {
    if (boardHasTrail(framesRef.current)) return;
    const rect = trailRectAt(at);
    const created: LabFrame = { id: TRAIL_FRAME_ID, name: TRAIL_FRAME_LABEL, x: rect.x, y: rect.y, width: rect.width, height: rect.height, local: true };
    framesRef.current = [...framesRef.current, created];
    setFrames((current) => (current ? [...current, created] : [created]));
    const boardExisted = boardIdRef.current != null;
    if (!(await materialize())) return;
    if (boardExisted) {
      const result = await lab.persist({ type: "frame_create", frame: { key: created.id, kind: "custom", taskId: null, label: TRAIL_FRAME_LABEL, x: created.x, y: created.y, w: created.width, h: created.height, ord: 0 } });
      report(result, "frame", "create");
      if (result.status !== "saved") return;
      if (result.created?.frameId) {
        const id = result.created.frameId;
        const version = result.versions[id] ?? 1;
        setFrames((current) => (current ? markFrameSaved(current, created.id, id, version) : current));
        framesRef.current = markFrameSaved(framesRef.current, created.id, id, version);
      }
    }
    noteWorkboardChangeSaved(orgId, "trail", "created");
    setAnnouncement("Reasoning trail added.");
  }

  // W3: the colour block is retired. A drawn region is a frame now, so this
  // write path is closed on purpose rather than left dormant.

  async function addTextBlock(at = boardPointFromScreen(viewportCentre())) {
    const id = `text:${crypto.randomUUID()}`;
    const node: LabNode = {
      id, clientKey: id, kind: "text", frame: null, title: "Text block", summary: "", typeLabel: "text block",
      ownership: "yours", textSize: "label", textWeight: "medium", textColour: "ink", local: true,
      x: Math.round(at.x - 130), y: Math.round(at.y - 40), width: 260, height: 80,
    };
    nodesRef.current = [...nodesRef.current, node];
    setNodes((current) => [...(current ?? []), node]);
    setKeyboardId(id);
    if (!(await ensureNodeDurable(id))) {
      nodesRef.current = nodesRef.current.filter((entry) => entry.id !== id);
      setNodes((current) => current?.filter((entry) => entry.id !== id) ?? current);
      setAnnouncement("That text block could not be saved.");
      return;
    }
    noteWorkboardNodeCreated(orgId, "text");
    setAnnouncement("Text block added.");
  }

  async function addSticky(at = boardPointFromScreen(viewportCentre())) {
    const id = `sticky:${crypto.randomUUID()}`;
    const { width, height } = WORKBOARD_STICKY_DEFAULT_SIZE;
    const node: LabNode = {
      id, clientKey: id, kind: "sticky", frame: null, title: "Sticky", summary: "", typeLabel: "sticky",
      ownership: "yours", textSize: "body", textWeight: "regular", textColour: "ink", stickyFill: "yellow", local: true,
      x: Math.round(at.x - width / 2), y: Math.round(at.y - height / 2), width, height,
    };
    nodesRef.current = [...nodesRef.current, node];
    setNodes((current) => [...(current ?? []), node]);
    setKeyboardId(id);
    if (!(await ensureNodeDurable(id))) {
      nodesRef.current = nodesRef.current.filter((entry) => entry.id !== id);
      setNodes((current) => current?.filter((entry) => entry.id !== id) ?? current);
      setAnnouncement("That sticky could not be saved.");
      return;
    }
    noteWorkboardNodeCreated(orgId, "sticky");
    setAnnouncement("Sticky added.");
  }

  async function removeTrail() {
    const frame = framesRef.current.find((entry) => isTrailFrameId(entry.id));
    if (!frame) return;
    if (!frame.durableId) {
      setFrames((current) => current?.filter((entry) => entry.id !== frame.id) ?? current);
      framesRef.current = framesRef.current.filter((entry) => entry.id !== frame.id);
      noteWorkboardChangeSaved(orgId, "trail", "removed");
      setAnnouncement("Reasoning trail removed.");
      return;
    }
    const result = await lab.persist({ type: "frame_archive", frameId: frame.durableId, expectedVersion: frame.durableVersion ?? 1 });
    report(result, "frame", "archive");
    if (result.status !== "saved") return;
    setFrames((current) => current?.filter((entry) => entry.id !== frame.id) ?? current);
    framesRef.current = framesRef.current.filter((entry) => entry.id !== frame.id);
    noteWorkboardChangeSaved(orgId, "trail", "removed");
    setAnnouncement("Reasoning trail removed.");
  }

  function startTrailDrag(frame: LabFrame, event: React.PointerEvent) {
    if (spaceRef.current) return;
    if (event.button !== 0 || (event.target as Element).closest("button,textarea,input")) return;
    event.stopPropagation();
    setInteraction("drag");
    frameDragRef.current = { id: frame.id, origin: { x: frame.x, y: frame.y }, from: { x: event.clientX, y: event.clientY }, members: [] };
  }

  function startGroupingDrag(frame: LabFrame, event: React.PointerEvent) {
    if (spaceRef.current) return;
    if (event.button !== 0 || (event.target as Element).closest("button,textarea,input")) return;
    event.stopPropagation();
    setInteraction("drag");
    frameDragRef.current = {
      id: frame.id,
      origin: { x: frame.x, y: frame.y },
      from: { x: event.clientX, y: event.clientY },
      members: groupingDragSnapshot(frame, visibleNodes.filter((node) => !pieceChatRef.current.has(node.id))),
    };
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

  /** The width the control row actually has, so it can shed controls instead of running past its box. */
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  useEffect(() => {
    const element = toolbarRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () => setToolbarWidth(element.clientWidth);
    const observer = new ResizeObserver(read);
    observer.observe(element);
    read();
    return () => observer.disconnect();
  }, []);

  const toolbarItems: { spec: ToolbarControlSpec; row: ReactNode; menu?: ReactNode }[] = [];
  const setStructured = (checked: boolean) => {
    const next = checked ? "structured" : "freeform";
    if (next === structureMode) return;
    setStructureMode(next);
    if (!checked) setSelectedFrameId(null);
    rememberStructureMode(next);
    noteWorkboardStructureToggled(orgId, next);
  };
  toolbarItems.push({
    spec: { id: "workstreams", width: 40, moveOrder: 1 },
    row: (
      <ToolbarIcon label="Show workstreams"><Button type="button" size="icon" variant={structureMode === "structured" ? "secondary" : "outline"} aria-label="Show workstreams" aria-pressed={structureMode === "structured"} data-toolbar-control="workstreams" onClick={() => setStructured(structureMode !== "structured")}><GraphiteIcon name="workstreams" animate={false} /></Button></ToolbarIcon>
    ),
    menu: (
      <DropdownMenuCheckboxItem checked={structureMode === "structured"} onCheckedChange={setStructured}>Show workstreams</DropdownMenuCheckboxItem>
    ),
  });
  toolbarItems.push({
    spec: { id: "working-from", width: 0, pinned: true },
      row: <ToolbarIcon label="Working from"><Button type="button" size="icon" variant="outline" className="md:hidden" aria-label="Working from" data-toolbar-control="working-from" onClick={() => setAskOpen(true)}><GraphiteIcon name="working-from" animate={false} /></Button></ToolbarIcon>,
  });
  if (selectedLinkId) {
    toolbarItems.push({
      spec: { id: "remove-relationship", width: 160, moveOrder: 6 },
      row: <Button type="button" size="sm" variant="ghost" onClick={() => { const link = links.find((entry) => entry.id === selectedLinkId); if (link) removeRelationship(link); }}>Remove relationship</Button>,
      menu: <DropdownMenuItem onSelect={() => { const link = links.find((entry) => entry.id === selectedLinkId); if (link) removeRelationship(link); }}>Remove relationship</DropdownMenuItem>,
    });
  }
  if (canAddWork) {
    toolbarItems.push({
      spec: { id: "add-work", width: 112, pinned: true },
      row: <ToolbarIcon label="Add work"><Button size="sm" variant="outline" aria-label="Add work" data-toolbar-control="add-work" onClick={() => openAddWork("header", null)}><GraphiteIcon name="work" animate={false} />Add work</Button></ToolbarIcon>,
    });
    toolbarItems.push({
      spec: { id: "add-text", width: 92, moveOrder: 4 },
      row: <ToolbarIcon label="Add text"><Button size="icon" variant="outline" aria-label="Add text" data-toolbar-control="add-text" onClick={() => void addTextBlock()}><GraphiteIcon name="text" animate={false} /></Button></ToolbarIcon>,
      menu: <DropdownMenuItem onSelect={() => void addTextBlock()}>Add text</DropdownMenuItem>,
    });
    toolbarItems.push({
      spec: { id: "add-sticky", width: 92, moveOrder: 4 },
      row: <ToolbarIcon label="Sticky"><Button size="icon" variant="outline" aria-label="Sticky" data-toolbar-control="add-sticky" onClick={() => void addSticky()}><GraphiteIcon name="sticky" animate={false} /></Button></ToolbarIcon>,
      menu: <DropdownMenuItem onSelect={() => void addSticky()}>Sticky</DropdownMenuItem>,
    });
    toolbarItems.push({
      spec: { id: "region", width: 84, moveOrder: 5 },
      row: <ToolbarIcon label="Add grouping"><Button size="icon" variant={drawTool ? "secondary" : "outline"} aria-label="Add grouping" aria-pressed={drawTool} data-toolbar-control="grouping" onClick={toggleDrawTool}><GraphiteIcon name="grouping" animate={false} /></Button></ToolbarIcon>,
      menu: <DropdownMenuItem onSelect={toggleDrawTool}>Add grouping</DropdownMenuItem>,
    });
  }
  if (showExample) {
    toolbarItems.push({
      spec: { id: "example", width: 174, moveOrder: 8 },
      row: <ToolbarIcon label="See an example board"><Button size="sm" variant="outline" aria-label="See an example board" data-toolbar-control="example" onClick={openExample}><GraphiteIcon name="example-board" animate={false} />See an example board</Button></ToolbarIcon>,
      menu: <DropdownMenuItem onSelect={openExample}>See an example board</DropdownMenuItem>,
    });
  }
  toolbarItems.push({
    spec: { id: "ask", width: 40, pinned: true },
    row: <ToolbarIcon label="Ask Lasso"><Button size="icon" variant={askOpen ? "secondary" : "outline"} aria-label="Ask Lasso" aria-pressed={askOpen} data-toolbar-control="ask" className="[&_canvas]:max-h-full [&_canvas]:max-w-full" onClick={() => setAskOpen((current) => !current)}><LassoThinkingMark kind="signature" size={LOOP_SIZE_TOOLBAR} /></Button></ToolbarIcon>,
  });
  if (canAddWork) {
    toolbarItems.push({
      spec: { id: "share", width: 80, pinned: true },
      row: <ShareDialog engagementId={engagementId} profileId={profile?.id} />,
    });
  }
  toolbarItems.push({
    spec: { id: "details", width: 86, moveOrder: 9 },
    row: <ToolbarIcon label="Details"><Button size="sm" variant="outline" aria-label="Details" data-toolbar-control="details" aria-expanded={detailsOpen} onClick={(event) => openDetails(event.currentTarget)}><GraphiteIcon name="analyses" animate={false} />Details</Button></ToolbarIcon>,
    menu: <DropdownMenuItem onSelect={() => { if (moreButtonRef.current) openDetails(moreButtonRef.current); }}>Details</DropdownMenuItem>,
  });
  toolbarItems.push({
    spec: { id: "fit", width: 56, moveOrder: 10 },
    row: <ToolbarIcon label="Fit"><Button size="icon" variant="outline" aria-label="Fit" data-toolbar-control="fit" onClick={() => fit(true)}><GraphiteIcon name="fit" animate={false} /></Button></ToolbarIcon>,
    menu: <DropdownMenuItem onSelect={() => fit(true)}>Fit</DropdownMenuItem>,
  });
  toolbarItems.push({
    spec: { id: "zoom", width: 116, pinned: true },
    row: (
      <>
        <ToolbarIcon label="Zoom out"><Button size="icon" variant="ghost" aria-label="Zoom out" data-toolbar-control="zoom-out" onClick={() => zoomAtCentre(stepZoom(zoomRef.current, "out"))}><GraphiteIcon name="minus" size={14} animate={false} /></Button></ToolbarIcon>
        <button type="button" aria-label="Zoom to 100 percent" className="w-10 text-center font-mono text-[10px] text-soft" onClick={() => zoomAtCentre(1)}>{Math.round(zoom * 100)}%</button>
        <ToolbarIcon label="Zoom in"><Button size="icon" variant="ghost" aria-label="Zoom in" data-toolbar-control="zoom-in" onClick={() => zoomAtCentre(stepZoom(zoomRef.current, "in"))}><GraphiteIcon name="plus" size={14} animate={false} /></Button></ToolbarIcon>
      </>
    ),
  });
  const toolbarPlan = planToolbarOverflow(toolbarWidth > 0 ? toolbarWidth : Number.MAX_SAFE_INTEGER, toolbarItems.map((item) => item.spec));
  const toolbarOverflowItems = toolbarItems.filter((item) => toolbarPlan.overflow.includes(item.spec.id));

  return (
    <TooltipProvider delayDuration={250}>
    <div className="fixed inset-0 z-50 flex bg-[var(--nb-paper)]" data-testid="canvas-lab-shell" data-interaction={interaction === "idle" && connectSource ? "connect" : interaction}>
      <aside className="z-30 flex w-[52px] shrink-0 flex-col items-center border-r border-border bg-card py-3">
        <LassoLoopMark className="h-7 w-7 text-lasso-green" />
        <Button className="mt-5" size="icon" variant="ghost" aria-label="Open workboard menu" onClick={() => setMenuOpen(true)}><Menu className="h-4 w-4" /></Button>
        <Button className="mt-auto" size="icon" variant="ghost" aria-label="Back to engagement" asChild><Link to="/engagements/$id" params={{ id: engagementId }} search={{ ...DETAILS_SEARCH }}><X className="h-4 w-4" /></Link></Button>
      </aside>
      {menuOpen ? <div className="fixed inset-0 z-50 flex bg-[var(--nb-scrim)]" onPointerDown={() => setMenuOpen(false)}><aside className="h-full w-[280px] overflow-y-auto border-r border-border bg-sidebar p-4 shadow-[var(--shadow-modal)]" onPointerDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-serif text-xl text-foreground">Lasso</span><Button size="icon" variant="ghost" aria-label="Close workboard menu" onClick={() => setMenuOpen(false)}><X className="h-4 w-4" /></Button></div><SidebarNav onNavigate={() => setMenuOpen(false)} onOpenSettings={() => void navigate({ to: "/settings" })} /><div className="mt-6 border-t border-border pt-4"><label className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft" htmlFor="canvas-lab-new-frame">Add workstream</label><div className="mt-2 flex gap-2"><input id="canvas-lab-new-frame" maxLength={60} value={newFrameName} onChange={(event) => { setNewFrameName(event.target.value); if (event.target.value.trim()) setNewFrameError(false); }} className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-input bg-background px-2 text-[12px]" placeholder="Workstream name" /><Button size="sm" variant="outline" onClick={() => { if (addWorkstream(newFrameName)) { setNewFrameName(""); setNewFrameError(false); } else setNewFrameError(true); }}>Add</Button></div>{newFrameError ? <p className="mt-1 font-hand text-[13px] text-destructive">a workstream needs a name</p> : <p className="mt-1 font-hand text-[13px] text-[var(--nb-mid)]">not saved</p>}</div></aside></div> : null}
      <main className={`relative min-w-0 flex-1 flex-col ${mobileView === "board" ? "flex" : "hidden md:flex"}`}>
        <header className="relative z-20 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
          <div className="min-w-0 shrink"><span className="block truncate text-[13px] font-medium text-foreground">{title}</span><span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{status}</span></div>
          <div ref={toolbarRef} className="canvas-lab-toolbar flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
            {toolbarItems.filter((item) => toolbarPlan.row.includes(item.spec.id)).map((item) => <div key={item.spec.id} className="flex shrink-0 items-center gap-2">{item.row}</div>)}
            {toolbarOverflowItems.length > 0 ? (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button ref={moreButtonRef} size="icon" variant="ghost" aria-label="More board controls" data-toolbar-control="more"><GraphiteIcon name="more" animate={false} /></Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>More board controls</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  {toolbarOverflowItems.map((item) => <Fragment key={item.spec.id}>{item.menu}</Fragment>)}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
            <PopoverAnchor virtualRef={detailsAnchorVirtualRef} />
            <PopoverContent align="end" className="w-80" data-testid="board-details-popover">
              <BoardDetailsContent
                engagement={engagement}
                coaches={page?.coaches ?? []}
                members={page?.members ?? []}
                engagementId={engagementId}
              />
            </PopoverContent>
          </Popover>
          {drawTool ? <div className="canvas-lab-region-palette"><RegionColourSwatches value={regionFill} onChange={setRegionFill} /></div> : null}
        </header>
        {lab.saveState.status === "conflict" ? <div data-testid="canvas-lab-banner" className="canvas-lab-banner" role="alert"><p className="text-[13px] text-foreground">A newer version of this record was saved.</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => resolveConflict("latest")}>Load latest</Button><Button size="sm" variant="outline" onClick={() => resolveConflict("retry")}>Retry my change</Button></div></div> : null}
        {lab.saveState.status === "error" ? <div data-testid="canvas-lab-banner" className="canvas-lab-banner" role="alert"><p className="text-[13px] text-foreground">Could not save your last change. {lab.saveState.message}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => resolveSaveError("retry")}>Retry</Button><Button size="sm" variant="outline" onClick={() => resolveSaveError("discard")}>Discard</Button></div></div> : null}
        <div ref={shellRef} tabIndex={-1} onDragOver={(event) => { if (!canAddWork || !isAnswerDrag(event.dataTransfer.types)) return; event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { if (!isAnswerDrag(event.dataTransfer.types)) return; event.preventDefault(); delete document.body.dataset["answerDrag"]; const answer = parseAnswerDrop(event.dataTransfer.getData(ANSWER_DRAG_MIME)); if (!answer) return; void keepAnswerAsCard(answer, { at: stagePoint(event.clientX, event.clientY), via: "drag" }); }} onPointerDownCapture={(event) => { if (event.button === 0 && spaceRef.current) { event.preventDefault(); event.stopPropagation(); startSpacePan(event); } }} onPointerDown={(event) => { const target = event.target as HTMLElement; const empty = event.target === event.currentTarget || target.dataset["testid"] === "canvas-lab-stage"; if (event.button === 0 && empty && drawTool) { event.preventDefault(); const at = stagePoint(event.clientX, event.clientY); drawingRef.current = { from: at, to: at }; setDrawing({ from: at, to: at }); return; } if (event.button === 1 && empty) { event.preventDefault(); startSpacePan(event); return; } if (event.button === 0 && empty) { event.preventDefault(); window.getSelection()?.removeAllRanges(); event.currentTarget.classList.add("select-none"); setKeyboardId(null); setSelectedFrameId(null); setSelectedLinkId((current) => relationshipSelection(current, "deselect")); if (event.pointerType === "touch") { event.currentTarget.classList.remove("select-none"); startSpacePan(event); return; } const at = stagePoint(event.clientX, event.clientY); const screen = { x: event.clientX, y: event.clientY }; marqueeRef.current = { fromScreen: screen, fromBoard: at, toScreen: screen, toBoard: at }; setInteraction("marquee"); } }} onContextMenu={(event) => { const target = event.target as HTMLElement; const empty = event.target === event.currentTarget || target.dataset["testid"] === "canvas-lab-stage"; if (!empty || !canAddWork) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }; setBoardMenu({ screen, board: boardPointFromScreen(screen) }); }} data-space-pan={spaceHeld} data-drawing={drawTool ? "true" : undefined} onScroll={(event) => keepViewportUnscrolled(event.currentTarget)} data-interacting={interaction !== "idle" || drawing !== null ? "true" : undefined} className="canvas-lab-surface relative min-h-0 flex-1 overflow-hidden">
          {boardReady ? <div data-testid="canvas-lab-stage" tabIndex={-1} className="canvas-lab-stage absolute left-0 top-0 origin-top-left" style={{ width: bounds.width, height: bounds.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, "--lab-inverse-zoom": labInverseZoom(zoom) } as CSSProperties}>
            {visibleNodes.filter((node) => node.kind === "shape").map((node) => <LabColourBlock key={node.id} node={node} selected={keyboardId === node.id} editable={Boolean(lab.board?.canEditStructure)} onSelect={() => { setKeyboardId(node.id); setSelectedFrameId(null); setSelectedLinkId(null); }} onDragStart={(event) => { if (decorationPointerIntent({ selected: keyboardId === node.id, onEdge: Boolean((event.target as HTMLElement).dataset["edge"]) }) === "drag") onCardPointerDown(node, event); }} onResizeStart={(corner, event) => startResize("shape", node.id, corner, node, event)} onResizeKeyDown={(corner, event) => keyboardResize("shape", node.id, corner, node, event)} onResizeKeyUp={finishKeyboardResize} onRemove={() => deleteNode(node)} />)}
            {marquee ? <div className="canvas-lab-marquee" aria-hidden="true" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} /> : null}
            {showGuides ? <ReasoningTrailGuide onAdd={addNode} /> : null}
            {!showGuides && trailFrame ? <ReasoningTrailGuide onAdd={addNode} rect={{ x: trailFrame.x, y: trailFrame.y, width: trailFrame.width, height: trailFrame.height }} onHandlePointerDown={canAddWork ? (event) => startTrailDrag(trailFrame, event) : undefined} onRemove={canAddWork ? () => void removeTrail() : undefined} /> : null}
            {showGuides ? <FoundationGuide brief={engagement?.brief ?? null} tasks={workstreamTasks(page?.tasks ?? []).map((task) => ({ id: task.id, name: task.name, detail: task.detail }))} work={workItems} /> : null}
            {/* The context region is not a workstream, so it is drawn whether or not the workstream outlines are showing. */}
            {boardFrames.filter((frame) => !isTrailFrameId(frame.id) && (structureMode === "structured" || frameKindOf(frame) === "context")).map((frame) => { const kind = frameKindOf(frame); const count = visibleNodes.filter((node) => node.frame === frame.id).length; const custom = kind === "custom"; const removable = !allNodes.some((node) => node.frame === frame.id); const region = isRegionFrameId(frame.id); return <LabFrameElement key={frame.id} frame={frame} count={count} region={region} fillStyle={region ? regionFillStyle(frame.fill) : undefined} selected={selectedFrameId === frame.id} editable={Boolean(lab.board?.canEditStructure)} custom={custom} kind={kind} namedByWorkstream={kind === "task"} removable={removable} onSelect={() => { setSelectedFrameId(frame.id); setKeyboardId(null); setSelectedLinkId((current) => relationshipSelection(current, "deselect")); }} onDragStart={region && lab.board?.canEditStructure ? (event) => startGroupingDrag(frame, event) : undefined} onResizeStart={(corner, event) => startResize("frame", frame.id, corner, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, event)} onResizeKeyDown={(corner, event) => keyboardResize("frame", frame.id, corner, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, event)} onResizeKeyUp={finishKeyboardResize} onFit={() => fitFrame(frame)} onRename={(name) => renameFrame(frame, name)} onRemove={() => kind === "context" ? void removeContextArea(frame) : removeFrame(frame)} onMenuOpened={() => noteWorkboardCardMenuOpened(orgId, "frame", "shared")} onMenuOpenChange={setCardMenuOpen} onAddWorkstream={frame.id === "workstreams" ? addWorkstream : undefined} onAddContext={kind === "context" && canAddWork ? () => openAddWork("context_menu", null, "context") : undefined} onUseAsContext={() => useFrameAsContext(frame)} />; })}
            {structureMode === "structured" && Boolean(lab.board?.canEditStructure) && !boardFrames.some((frame) => frame.id === "workstreams") ? (() => { const anchor = workstreamAddAnchor(boardFrames, visibleNodes); if (!anchor) return null; return <div className="canvas-lab-inline-add" style={{ left: anchor.x, top: anchor.y, width: BOARD_INLINE_ADD_SIZE.width, minHeight: BOARD_INLINE_ADD_SIZE.height, transform: `scale(${1 / zoom})`, transformOrigin: "top left" }}>{inlineAddOpen ? <div className="canvas-lab-inline-workstream"><input aria-label="Workstream name" ref={inlineNameRef} maxLength={60} value={inlineFrameName} onChange={(event) => { setInlineFrameName(event.target.value); if (event.target.value.trim()) setInlineFrameError(false); }} onKeyDown={(event) => { if (event.key === "Enter" && addWorkstream(inlineFrameName)) { setInlineFrameName(""); setInlineFrameError(false); setInlineAddOpen(false); } if (event.key === "Escape") { setInlineAddOpen(false); setInlineFrameError(false); } }} /><button type="button" onClick={() => { if (addWorkstream(inlineFrameName)) { setInlineFrameName(""); setInlineFrameError(false); setInlineAddOpen(false); } else setInlineFrameError(true); }}>Add</button>{inlineFrameError ? <span>a workstream needs a name</span> : null}</div> : <button type="button" className="canvas-lab-add-workstream" onClick={() => setInlineAddOpen(true)}>+ workstream</button>}</div>; })() : null}
            <svg className="canvas-lab-relationships absolute inset-0 overflow-visible" width={bounds.width} height={bounds.height} aria-label="Local workboard relationships">
              {visibleNodes.filter((node) => node.kind === "chat").flatMap((draft) => (draft.contextIds ?? []).map((contextId) => { const source = visibleNodes.find((node) => node.id === contextId); if (!source) return null; const sx = source.x + source.width; const sy = source.y + source.height / 2; const tx = draft.x; const ty = draft.y + draft.height / 2; const middle = (sx + tx) / 2; return <path key={`${draft.id}:${contextId}`} d={`M ${sx} ${sy} C ${middle} ${sy}, ${middle} ${ty}, ${tx} ${ty}`} fill="none" stroke="var(--nb-graphite)" strokeWidth="1.4" strokeDasharray="4 4" strokeLinecap="round" className="pointer-events-none" />; }))}
              <LabBundleLinks nodes={visibleNodes} bundles={bundleView.bundles} />
              <LabRelationships links={links} nodes={visibleNodes} measuredHeights={cardHeightsRef.current} selectedLinkId={selectedLinkId} inverseZoom={labInverseZoom(zoom)} onSelect={(id) => { setKeyboardId(null); setSelectedFrameId(null); setSelectedLinkId((current) => relationshipSelection(current, "select", id)); }} onHover={setHoveredLinkId} />
              {connectorPreview && connectorDragRef.current ? (() => { const source = visibleNodes.find((node) => node.id === connectorDragRef.current?.nodeId); if (!source || !connectorDragRef.current) return null; const from = labAnchorPoint(source, connectorDragRef.current.anchor, cardHeightsRef.current.get(source.id) ?? 108); return <path d={labConnectorPath(from, connectorDragRef.current.anchor, connectorPreview, connectorDragRef.current.anchor)} fill="none" stroke="var(--nb-green)" strokeWidth="2.4" strokeLinecap="round" className="pointer-events-none" />; })() : null}
            </svg>
            {visibleNodes.filter((node) => node.kind === "sticky").map((node) => <LabSticky key={node.id} node={node} selected={keyboardId === node.id} editable={Boolean(node.local)} layoutEditable={Boolean(lab.board?.canEditStructure)} onSelect={() => { setKeyboardId(node.id); setSelectedFrameId(null); setSelectedLinkId(null); }} onDragStart={(event) => { if (decorationPointerIntent({ selected: keyboardId === node.id, onEdge: Boolean((event.target as HTMLElement).dataset["edge"]) }) === "drag") onCardPointerDown(node, event); }} onResizeStart={(corner, event) => startResize("sticky", node.id, corner, node, event)} onResizeKeyDown={(corner, event) => keyboardResize("sticky", node.id, corner, node, event)} onResizeKeyUp={finishKeyboardResize} onChange={(body) => setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, summary: body.text, textSize: body.size, textWeight: body.weight, textColour: body.colour, stickyFill: body.fill } : entry) ?? current)} onCommit={(body) => { noteWorkboardNodeEdited(orgId, "sticky"); void persistNodePatch(node.id, { body: serializeWorkboardStickyBody(body) }); }} onRemove={() => deleteNode(node)} />)}
            {visibleNodes.filter((node) => node.kind === "text").map((node) => <LabTextBlock key={node.id} node={node} selected={keyboardId === node.id} editable={Boolean(node.local)} layoutEditable={Boolean(lab.board?.canEditStructure)} onSelect={() => { setKeyboardId(node.id); setSelectedFrameId(null); setSelectedLinkId(null); }} onDragStart={(event) => { if (decorationPointerIntent({ selected: keyboardId === node.id, onEdge: Boolean((event.target as HTMLElement).dataset["edge"]) }) === "drag") onCardPointerDown(node, event); }} onResizeStart={(corner, event) => startResize("text", node.id, corner, node, event)} onResizeKeyDown={(corner, event) => keyboardResize("text", node.id, corner, node, event)} onResizeKeyUp={finishKeyboardResize} onChange={(body) => setNodes((current) => current?.map((entry) => entry.id === node.id ? { ...entry, summary: body.text, textSize: body.size, textWeight: body.weight, textColour: body.colour } : entry) ?? current)} onCommit={(body: WorkboardTextBody) => { noteWorkboardNodeEdited(orgId, "text"); void persistNodePatch(node.id, { body: serializeWorkboardTextBody(body) }); }} onRemove={() => deleteNode(node)} />)}
            <LabBundleStackEdges nodes={visibleNodes} minimized={bundleView.minimized} />
            {visibleNodes.filter((node) => node.kind === "answer").map((node) => <LabAnswerCard key={node.id} node={node} focused={keyboardId === node.id} stackZ={cardStackZ(front, node.id)} onFocus={() => { setFront((current) => bringToFront(current, node.id)); setKeyboardId(node.id); setSelectedFrameId(null); }} onPointerDown={(event) => { setFront((current) => bringToFront(current, node.id)); onCardPointerDown(node, event); }} onDelete={() => deleteNode(node)} frameChoices={structureMode === "structured" ? boardFrames.filter((frame) => !isContextFrameId(frame.id) && !isTrailFrameId(frame.id)).map((frame) => ({ id: frame.id, name: frame.name })) : []} onMoveToFrame={structureMode === "structured" && lab.board?.canEditStructure ? (frameId) => moveToFrame(node, frameId) : undefined} />)}
            {visibleNodes.filter((node) => node.kind !== "answer" && !isWorkboardDecorationKind(node.kind)).map((node) => { const bundleChatId = pieceChat.get(node.id); const canResize = !bundleChatId && Boolean(lab.board?.canEditStructure) && (node.kind !== "judgment" || Boolean(node.local)); const cardItem = itemByNode(node); return <LabCard key={node.id} node={node} item={cardItem} preview={cardItem ? cardPreviews[cardItem.id] : undefined} filePreview={cardItem ? filePreviews[cardItem.id] : undefined} onPreviewScroll={cardItem ? (kind) => notePreviewScroll(cardItem, kind) : undefined} selected={selected.includes(node.id) || marqueePreview.includes(node.id)} focused={keyboardId === node.id} focusOnMount={pendingJudgmentFocusId === node.id} connecting={connectSource !== null || connectorPreview !== null} connectSourceAnchor={connectSource?.nodeId === node.id ? connectSource.anchor : null} onSelect={() => { setAnnouncement(selected.includes(node.id) ? "Removed from context" : "Added to context"); setSelected((current) => toggleContext(current, node.id)); }} onOpen={(origin) => openNode(node, origin)} onBranch={() => branchFrom(node)} onHide={() => hideNode(node)} onDelete={() => deleteNode(node)} onTakeOutOfContext={isContextFrameId(node.frame) && node.workItemId ? () => void takeOutOfContext(node) : undefined} onEdit={(text) => setNodes((current) => current ? updateLocalNode(current, node.id, text) : current)} onEditCommitted={() => { noteWorkboardNodeEdited(orgId, eventKind(node)); const current = nodesRef.current.find((entry) => entry.id === node.id); if (current?.durableId) void persistNodePatch(current.id, { body: current.summary, title: current.title }); }} onAnchorPointerDown={(side, event) => startPointerConnect(node, side, event)} onAnchorActivate={(side) => chooseConnectAnchor(node, side)} onMenuOpened={() => { if (connectSource || connectorDragRef.current) cancelConnect(); noteWorkboardCardMenuOpened(orgId, eventKind(node), node.ownership); }} onMenuOpenChange={setCardMenuOpen} onMeasure={(height) => cardHeightsRef.current.set(node.id, height)} onPointerDown={(event) => { setFront((current) => bringToFront(current, node.id)); onCardPointerDown(node, event); }} onFocus={() => { setFront((current) => bringToFront(current, node.id)); setKeyboardId(node.id); setSelectedFrameId(null); setSelectedLinkId((current) => relationshipSelection(current, "deselect")); if (pendingJudgmentFocusId === node.id) setPendingJudgmentFocusId(null); }} onKeyDown={(event) => onCardKeyDown(node, event)} canResize={canResize} onResizeStart={(corner, event) => startResize("card", node.id, corner, { x: node.x, y: node.y, width: node.width, height: node.height }, event)} onResizeKeyDown={(corner, event) => keyboardResize("card", node.id, corner, { x: node.x, y: node.y, width: node.width, height: node.height }, event)} onResizeKeyUp={finishKeyboardResize} onFit={() => fitCard(node)} frameChoices={boardFrames.filter((frame) => !isContextFrameId(frame.id) && !isTrailFrameId(frame.id)).map((frame) => ({ id: frame.id, name: frame.name }))} structured={structureMode === "structured"} onMoveToFrame={(frameId) => moveToFrame(node, frameId)} stackZ={cardStackZ(front, node.id)} commentCount={node.workItemId ? commentCounts[node.workItemId] ?? 0 : 0} onOpenComments={() => { setFocusOrigin(null); setFocusOpensComments(true); setFocusId(node.id); }} madeInChat={bundleChatId ? visibleNodes.find((entry) => entry.id === bundleChatId)?.title : undefined} bundleToggleLabel={bundles.has(node.id) ? (bundleView.minimized.has(node.id) ? "Show pieces" : "Minimize pieces") : undefined} onBundleToggle={bundles.has(node.id) ? () => toggleBundle(node, bundleView.minimized.has(node.id) ? "expanded" : "minimized", "menu") : undefined} />; })}
            <LabBundleControls nodes={visibleNodes} bundles={bundleView.bundles} more={bundleView.more} minimized={bundleView.minimized} zoom={zoom} onToggle={(chat, state) => toggleBundle(chat, state, "control")} />
            <svg className="canvas-lab-relationship-overlays absolute inset-0 overflow-visible" width={bounds.width} height={bounds.height} aria-label="Workboard relationship labels">
              <LabRelationshipOverlays links={links} nodes={visibleNodes} measuredHeights={cardHeightsRef.current} selectedLinkId={selectedLinkId} hoveredLinkId={hoveredLinkId} inverseZoom={labInverseZoom(zoom)} zoom={zoom} editable={Boolean(lab.board?.canEditStructure)} onRemove={removeRelationship} onHover={setHoveredLinkId} />
            </svg>
            {linkRejection ? (() => { const target = visibleNodes.find((node) => node.id === linkRejection.targetId); if (!target) return null; return <LabLinkRejection target={target} message={linkRejection.message} onClear={() => setLinkRejection(null)} />; })() : null}
            {dropPrompt ? (() => { const node = visibleNodes.find((entry) => entry.id === dropPrompt.nodeId); const frame = boardFrames.find((entry) => entry.id === dropPrompt.frameId); if (!node || !frame) return null; return <div data-drop-prompt="true" className="canvas-lab-drop-prompt" style={{ left: node.x, top: node.y + node.height + 10 }}><span>Move to {frame.name}?</span><button type="button" onClick={() => { moveToFrame(node, frame.id); closeDropPrompt("yes"); }}>Yes</button><button type="button" onClick={() => closeDropPrompt("keep")}>Keep</button></div>; })() : null}
            {drawing ? (() => { const rect = drawnRect(drawing.from, drawing.to); return <div data-testid="canvas-lab-draw-rect" className="canvas-lab-draw-rect" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} aria-hidden />; })() : null}
            {pendingWorkstream ? <div className="canvas-lab-draw-rect" style={{ left: pendingWorkstream.rect.x, top: pendingWorkstream.rect.y, width: pendingWorkstream.rect.width, height: pendingWorkstream.rect.height }} aria-hidden /> : null}
            {pendingWorkstream ? <div className="canvas-lab-draw-name" style={{ left: pendingWorkstream.rect.x + 8, top: pendingWorkstream.rect.y + 8, transform: `scale(${1 / zoom})`, transformOrigin: "top left" }}><div className="canvas-lab-inline-workstream"><input aria-label="Workstream name" ref={inlineNameRef} maxLength={60} value={pendingWorkstream.name} onChange={(event) => { const name = event.target.value; setPendingWorkstream((current) => current ? { ...current, name } : current); if (name.trim()) setPendingWorkstreamError(false); }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); void commitDrawnWorkstream(pendingWorkstream.name); } if (event.key === "Escape") { event.preventDefault(); cancelDraw(); } }} /><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => void commitDrawnWorkstream(pendingWorkstream.name)}>Add</button>{pendingWorkstreamError ? <span>a workstream needs a name</span> : null}</div></div> : null}
            {claimPrompt ? <div data-claim-prompt="true" className="canvas-lab-drop-prompt" style={{ left: claimPrompt.rect.x, top: claimPrompt.rect.y + claimPrompt.rect.height + 10 }}><span>{movePromptText(claimPrompt.cards.length)}</span><button type="button" onClick={() => void answerClaimPrompt("yes")}>Move them</button><button type="button" onClick={() => void answerClaimPrompt("keep")}>Leave them</button></div> : null}
          </div> : null}
          {pendingRegionName && shellRef.current ? <GroupingNamePopup frame={pendingRegionName} pan={pan} zoom={zoom} viewport={viewportSize} portalRoot={shellRef.current} onName={(name) => { setPendingRegionNameId(null); renameFrame(pendingRegionName, name); }} onDismiss={() => setPendingRegionNameId(null)} /> : null}
          {boardMenu ? (
            <>
              <div className="fixed inset-0 z-40" onPointerDown={() => setBoardMenu(null)} onContextMenu={(event) => { event.preventDefault(); setBoardMenu(null); }} />
              <div role="menu" className="absolute z-50 min-w-[180px] rounded-md border border-border bg-card p-1 shadow-md" style={{ left: boardMenu.screen.x, top: boardMenu.screen.y }}>
                <button type="button" role="menuitem" className="w-full rounded-[6px] px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-muted" onClick={() => { const at = boardMenu.board; setBoardMenu(null); openAddWork("context_menu", at); }}>Bring in work here</button>
                {hiddenNodes.length > 0 ? <div role="group" aria-label={`Put back on the board (${hiddenNodes.length})`} className="mt-1 border-t border-border pt-1"><p className="px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Put back on the board ({hiddenNodes.length})</p>{hiddenNodes.map((node) => <button key={node.id} type="button" role="menuitem" className="w-full truncate rounded-[6px] px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-muted" onClick={() => { setBoardMenu(null); restoreNode(node.id); }}>{node.title}</button>)}</div> : null}
                {!boardFrames.some((frame) => isContextFrameId(frame.id)) ? <button type="button" role="menuitem" className="w-full rounded-[6px] px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-muted" onClick={() => { const at = boardMenu.board; setBoardMenu(null); void addContextArea(at); }}>Add a context area</button> : null}
                {!showGuides && !trailFrame ? <button type="button" role="menuitem" className="w-full rounded-[6px] px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-muted" onClick={() => { const at = boardMenu.board; setBoardMenu(null); void addTrail(at); }}>Add a reasoning trail</button> : null}
              </div>
            </>
          ) : null}
          {undoToast ? <LabUndoToast message={undoToast.message} onUndo={() => undoFromToast(undoToast.entry)} onClose={() => setUndoToast(null)} /> : null}
          <CanvasLabStatusLine loading={loadingBoard} unavailable={isError || notAvailable} empty={boardReady && visibleNodes.length === 0} />
        </div>
        {boardReady && opening ? <div className={`pointer-events-none absolute inset-0 z-40 flex ${unfold.className}`} aria-hidden={!unfold.still}>{unfold.still ? <span className="sr-only">{unfold.reduced}</span> : null}<span className="canvas-lab-unfold-panel" /><span className="canvas-lab-unfold-panel" /><span className="canvas-lab-unfold-panel" /></div> : null}
      </main>
      {profile?.id && orgId ? <BoardAsk open={askOpen} onOpenChange={setAskOpen} engagementId={engagementId} engagementTitle={title} profileId={profile.id} orgId={orgId} canKeep={canAddWork} onKeep={(answer, via) => void keepAnswerAsCard(answer, { via: via ?? "button" })} boardContextItemIds={contextNodes.flatMap((node) => { const item = itemByNode(node); return item ? [item.id] : []; })} /> : null}
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {exampleOpen ? <ExampleBoardOverlay onClose={() => setExampleOpen(false)} /> : null}
      {canAddWork ? <AddWorkPanel open={addWorkOpen} onOpenChange={(next) => { setAddWorkOpen(next); if (!next) { setAddWorkAnchor(null); setAddWorkTarget("board"); } }} onPlace={addWorkToBoard} busy={addWorkBusy} /> : null}
      {focusNode ? <FocusOverlay node={focusNode} item={focusItem} origin={focusOrigin} onContentScroll={focusItem?.type === "ai_thread" ? () => notePreviewScroll(focusItem, "chat") : undefined} onSummarize={() => { branchFrom({ ...focusNode, prompt: `Summarize: ${focusNode.title}` }); setFocusId(null); }} onBranch={() => { branchFrom(focusNode); setFocusId(null); }} onClose={() => { setFocusId(null); setFocusOrigin(null); setFocusOpensComments(false); }} highlights={annotations.highlights} canWrite={canComment} openComments={focusOpensComments} threads={commentThreads.threads} onHighlight={focusThreadId ? (selection) => { void annotations.createHighlight({ turnNo: selection.turnNo, charStart: selection.charStart, charEnd: selection.charEnd, clientKey: crypto.randomUUID() }).then((result) => { if (result.status === "saved") noteHighlightChanged(orgId, "created", result.highlight.visibility, result.highlight.excerpt.length); }).catch(() => undefined); } : undefined} onRemoveHighlight={focusThreadId ? (highlight) => { void annotations.archiveHighlight({ id: highlight.id, expectedVersion: highlight.version }).then((result) => { if (result.status === "saved") noteHighlightChanged(orgId, "archived", highlight.visibility ?? "just_me", highlight.excerpt.length); }).catch(() => undefined); } : undefined} onSetHighlightVisibility={focusThreadId ? (highlight, visibility) => { void annotations.setHighlightVisibility({ id: highlight.id, visibility, expectedVersion: highlight.version }).then((result) => { if (result.status === "saved") noteAnnotationChanged(orgId, { kind: "highlight", action: "edited", anchorKind: "turn", visibility, length: highlight.excerpt.length, isReply: false }); }).catch(() => undefined); } : undefined} onCreateComment={focusThreadId ? (anchor, body) => { void commentThreads.createComment({ turnNo: anchor.turnNo, charStart: anchor.charStart, charEnd: anchor.charEnd, body, clientKey: crypto.randomUUID() }).then((result) => { if (result.status !== "saved") return; noteAnnotationChanged(orgId, { kind: "comment", action: "created", anchorKind: "turn", visibility: "engagement", length: body.length, isReply: false }); if (!needsHighlightForComment(annotations.highlights, anchor)) return; void annotations.createHighlight({ turnNo: anchor.turnNo, charStart: anchor.charStart, charEnd: anchor.charEnd, clientKey: crypto.randomUUID() }).then((marked) => { if (marked.status === "saved") noteHighlightChanged(orgId, "created", marked.highlight.visibility, marked.highlight.excerpt.length); }).catch(() => undefined); }).catch(() => undefined); } : undefined} onCreateReply={focusThreadId ? (parentId, body) => { void commentThreads.createReply({ parentId, body, clientKey: crypto.randomUUID() }).then((result) => { if (result.status === "saved") noteAnnotationChanged(orgId, { kind: "comment", action: "created", anchorKind: "item", visibility: "engagement", length: body.length, isReply: true }); }).catch(() => undefined); } : undefined} onEditComment={focusThreadId ? (comment, body) => { void commentThreads.editComment({ id: comment.id, body, expectedVersion: comment.version }).then((result) => { if (result.status === "saved") noteAnnotationChanged(orgId, { kind: "comment", action: "edited", anchorKind: comment.parentId ? "item" : "turn", visibility: "engagement", length: body.length, isReply: Boolean(comment.parentId) }); }).catch(() => undefined); } : undefined} onArchiveComment={focusThreadId ? (comment) => { void commentThreads.archiveComment({ id: comment.id, expectedVersion: comment.version }).then((result) => { if (result.status === "saved") noteAnnotationChanged(orgId, { kind: "comment", action: "archived", anchorKind: comment.parentId ? "item" : "turn", visibility: "engagement", length: comment.body.length, isReply: Boolean(comment.parentId) }); }).catch(() => undefined); } : undefined} /> : null}
      {reviewItem && reviewNode ? <CanvasLabReview item={reviewItem} anchorNodeId={reviewNode.id} links={links} profileId={profile?.id} decisions={page?.decisions ?? []} nodes={visibleNodes} comments={comments} onTrailSelect={(group, focus) => noteWorkboardTrailSelected(orgId, group, focus)} onClose={() => setReviewId(null)} /> : null}
    </div>
    </TooltipProvider>
  );
}
