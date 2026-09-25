/**
 * S3a: the shared board is the owner's board, read only.
 *
 * It builds the model with the same functions the live board page uses (the
 * virtual seed, then applyDurableBoard, then chat bundles and docking) and
 * draws it with the same frame, card, text, sticky, colour-block, answer and
 * relationship components. Every writing handler is a no-op, and the stage
 * swallows context menus and keys, so nothing here can change the board.
 * Zoom, pan, fit and opening a card to read it are what remain.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { LabBundleStackEdges } from "@/components/canvas-lab/LabBundleControls";
import { LabBundleLinks } from "@/components/canvas-lab/LabBundleLinks";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabColourBlock } from "@/components/canvas-lab/LabColourBlock";
import { LabFrame as LabFrameElement } from "@/components/canvas-lab/LabFrame";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import { LabSticky } from "@/components/canvas-lab/LabSticky";
import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import {
  applyBundleViews,
  applyDurableBoard,
  boardHasSeededStructure,
  chatBundles,
  createLabFrames,
  dockBundles,
  fitWorkboardViewport,
  labInverseZoom,
  seedBlankCanvas,
  seedCanvas,
  sizeSeedFrames,
  stageBounds,
  type LabFrame,
  type LabLink,
  type LabNode,
  type SeedInput,
} from "@/components/canvas-lab/canvas-lab-model";
import type { SharedBoardDto } from "@/lib/board-share-shared";
import type { WorkboardDto } from "@/lib/canvas-lab-shared";
import { isWorkboardDecorationKind } from "@/lib/canvas-lab-shared";
import { clampZoom, wheelPanVector, workboardPinchZoom, zoomAbout } from "@/lib/canvas-zoom";
import { isContextFrameId } from "@/lib/context-region";
import { isDeliverableType } from "@/lib/lineage-shared";
import { isTrailFrameId } from "@/lib/reasoning-trail";

const noop = () => undefined;

export type SharedBoardModel = {
  frames: LabFrame[];
  nodes: LabNode[];
  links: LabLink[];
  bundles: ReturnType<typeof applyBundleViews>;
};

/** The live page's model pipeline, fed the shared inputs. Pure. */
export function buildSharedBoardModel(dto: SharedBoardDto): SharedBoardModel {
  // The viewer is nobody: an empty id never equals an opaque author index.
  const board = { ...dto.board, viewerProfileId: "" } as WorkboardDto;
  const seeded = boardHasSeededStructure(board);
  const initialFrames = seeded ? createLabFrames(dto.seed.tasks) : [];
  const seedInput: SeedInput = {
    brief: dto.seed.brief ? { title: "The brief", text: dto.seed.brief.text } : null,
    tasks: dto.seed.tasks.map((task) => ({ ...task, ownedByViewer: false })),
    work: dto.seed.work.map((item) => ({
      id: item.id,
      title: item.title,
      typeLabel: item.type.replaceAll("_", " "),
      source: item.source,
      ownedByViewer: false,
      taskIds: item.taskIds,
      deliverable: isDeliverableType(item.type),
      bundle: item,
    })),
    decisions: dto.seed.decisions.map((decision) => ({ ...decision, ownedByViewer: false })),
  };
  const virtualNodes = seeded ? seedCanvas(seedInput, initialFrames) : seedBlankCanvas(seedInput);
  const virtualFrames = seeded ? sizeSeedFrames(initialFrames, virtualNodes) : [];
  const merged = applyDurableBoard({ frames: virtualFrames, nodes: virtualNodes }, board);
  const shown = merged.nodes.filter((node) => !merged.hiddenIds.includes(node.id));
  const bundles = chatBundles(shown, dto.seed.work);
  const workItemByNode = new Map(shown.map((node) => [node.id, node.workItemId]));
  const bundleView = applyBundleViews(bundles, {}, (chatId) => workItemByNode.get(chatId) ?? undefined);
  const nodes = dockBundles(
    bundleView.dropped.size ? shown.filter((node) => !bundleView.dropped.has(node.id)) : shown,
    bundleView.bundles,
  );
  return { frames: merged.frames, nodes, links: merged.links, bundles: bundleView };
}

function frameKindOf(frame: LabFrame): "foundation" | "task" | "decisions" | "outputs" | "custom" | "context" {
  if (isContextFrameId(frame.id)) return "context";
  if (frame.id === "foundation" || frame.id === "decisions" || frame.id === "outputs") return frame.id;
  return frame.id.startsWith("task:") ? "task" : "custom";
}

export function SharedBoardView({
  board,
  onNodeOpened,
}: {
  board: SharedBoardDto;
  /** Optional: told the kind of a card opened to read. The share page passes nothing. */
  onNodeOpened?: (kind: string) => void;
}) {
  const queryClient = useQueryClient();
  const model = useMemo(() => buildSharedBoardModel(board), [board]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const heightsRef = useRef(new Map<string, number>());
  const fittedRef = useRef(false);
  const [view, setView] = useState<{ zoom: number; pan: { x: number; y: number } } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  const itemsById = useMemo(() => new Map(board.seed.work.map((item) => [item.id, item])), [board.seed.work]);
  const frames = useMemo(
    () => model.frames.filter((frame) => !isTrailFrameId(frame.id) && frameKindOf(frame) === "context"),
    [model.frames],
  );
  const bounds = stageBounds(model.frames, model.nodes);

  // The reading view asks for turns by the same key the live board uses. The
  // viewer has no session, so the turns this link carried answer that key.
  useLayoutEffect(() => {
    queryClient.setQueryDefaults(["turns"], { staleTime: Number.POSITIVE_INFINITY, retry: false });
    for (const [id, turns] of Object.entries(board.turns)) queryClient.setQueryData(["turns", id], turns);
  }, [board.turns, queryClient]);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const fitted = fitWorkboardViewport(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      [],
      model.nodes,
      heightsRef.current,
      null,
    );
    setView({ zoom: fitted.zoom, pan: fitted.pan });
  }, [model.nodes]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!fittedRef.current) {
      fittedRef.current = true;
      fit();
    }
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fit]);

  // Wheel pans, pinch or a modifier zooms about the pointer. Nothing else.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement | null)?.closest("[data-shared-scroll]")) return;
      event.preventDefault();
      setView((current) => {
        if (!current) return current;
        if (event.ctrlKey || event.metaKey) {
          const rect = viewport.getBoundingClientRect();
          const nextZoom = clampZoom(workboardPinchZoom(current.zoom, event.deltaY, event.deltaMode));
          const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          return { zoom: nextZoom, pan: zoomAbout(current.pan, current.zoom, nextZoom, point) };
        }
        const delta = wheelPanVector(event);
        return { zoom: current.zoom, pan: { x: current.pan.x - delta.x, y: current.pan.y - delta.y } };
      });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Only the empty board pans. A card never moves, and pressing one never
    // moves the board under it either.
    if (event.button !== 0 || !view) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-node-id], .canvas-lab-text-block, .canvas-lab-sticky, .canvas-lab-colour-block, .canvas-lab-answer-card")) return;
    panRef.current = { x: view.pan.x, y: view.pan.y, startX: event.clientX, startY: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = panRef.current;
    if (!start) return;
    setView((current) => current ? { zoom: current.zoom, pan: { x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY } } : current);
  }

  function endPan() {
    panRef.current = null;
  }

  function openNode(node: LabNode, rect?: DOMRect) {
    setOrigin(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null);
    setFocusId(node.id);
    onNodeOpened?.(node.kind);
  }

  const focusNode = model.nodes.find((node) => node.id === focusId) ?? null;
  const focusItem = focusNode?.workItemId ? itemsById.get(focusNode.workItemId) ?? null : null;
  const zoom = view?.zoom ?? 1;

  return (
    <div
      ref={viewportRef}
      className="shared-board-viewport relative h-full overflow-hidden"
      data-testid="shared-board-view"
      data-read-only="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onContextMenuCapture={(event) => { event.preventDefault(); event.stopPropagation(); }}
      onKeyDownCapture={(event) => {
        // Reading keys (Tab, Enter on an open control) pass; nothing that edits does.
        if (event.key === "Tab" || event.key === "Enter" || event.key === " ") return;
        if ((event.target as HTMLElement).closest("[data-shared-overlay]")) return;
        event.stopPropagation();
      }}
      onDragStartCapture={(event) => event.preventDefault()}
    >
      <div
        className="canvas-lab-stage shared-board-stage absolute left-0 top-0 origin-top-left"
        data-testid="shared-board-stage"
        style={{
          width: bounds.width,
          height: bounds.height,
          visibility: view ? "visible" : "hidden",
          transform: view ? `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` : undefined,
          transformOrigin: "0 0",
          "--lab-inverse-zoom": labInverseZoom(zoom),
        } as CSSProperties}
      >
        {model.nodes.filter((node) => node.kind === "shape").map((node) => (
          <LabColourBlock key={node.id} node={node} selected={false} editable={false} onSelect={noop} onDragStart={noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onRemove={noop} />
        ))}
        {frames.map((frame) => (
          <LabFrameElement
            key={frame.id}
            frame={frame}
            count={model.nodes.filter((node) => node.frame === frame.id).length}
            kind={frameKindOf(frame)}
            selected={false}
            editable={false}
            custom={false}
            namedByWorkstream={false}
            removable={false}
            onSelect={noop}
            onResizeStart={noop}
            onResizeKeyDown={noop}
            onResizeKeyUp={noop}
            onFit={noop}
            onRename={noop}
            onRemove={noop}
            onMenuOpened={noop}
            onMenuOpenChange={noop}
            onUseAsContext={noop}
          />
        ))}
        <svg className="canvas-lab-relationships pointer-events-none absolute inset-0 overflow-visible" width={bounds.width} height={bounds.height} aria-hidden="true">
          <LabBundleLinks nodes={model.nodes} bundles={model.bundles.bundles} />
          <LabRelationships links={model.links} nodes={model.nodes} measuredHeights={heightsRef.current} selectedLinkId={null} inverseZoom={labInverseZoom(zoom)} onSelect={noop} />
        </svg>
        {model.nodes.filter((node) => node.kind === "sticky").map((node) => (
          <LabSticky key={node.id} node={{ ...node, local: false }} selected={false} editable={false} layoutEditable={false} onSelect={noop} onDragStart={noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={noop} onRemove={noop} />
        ))}
        {model.nodes.filter((node) => node.kind === "text").map((node) => (
          <LabTextBlock key={node.id} node={{ ...node, local: false }} selected={false} editable={false} layoutEditable={false} onSelect={noop} onDragStart={noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={noop} onRemove={noop} />
        ))}
        <LabBundleStackEdges nodes={model.nodes} minimized={model.bundles.minimized} />
        {model.nodes.filter((node) => node.kind === "answer").map((node) => (
          <LabAnswerCard key={node.id} node={{ ...node, local: false }} focused={false} stackZ={1} onFocus={noop} onPointerDown={noop} onDelete={noop} />
        ))}
        {model.nodes.filter((node) => node.kind !== "answer" && !isWorkboardDecorationKind(node.kind)).map((node) => {
          const item = node.workItemId ? itemsById.get(node.workItemId) : undefined;
          return (
            <LabCard
              key={node.id}
              node={{ ...node, local: false }}
              item={item}
              preview={item ? board.cardPreviews[item.id] : undefined}
              filePreview={item ? board.filePreviews[item.id] : undefined}
              readOnly
              selected={false}
              focused={false}
              connecting={false}
              connectSourceAnchor={null}
              onSelect={noop}
              onOpen={(rect) => openNode(node, rect)}
              onBranch={noop}
              onHide={noop}
              onDelete={noop}
              onEdit={noop}
              onEditCommitted={noop}
              onAnchorPointerDown={noop}
              onAnchorActivate={noop}
              onMenuOpened={noop}
              onMenuOpenChange={noop}
              onMeasure={(height) => heightsRef.current.set(node.id, height)}
              onPointerDown={noop}
              onFocus={noop}
              onKeyDown={noop}
              canResize={false}
              onResizeStart={noop}
              onFit={noop}
              onResizeKeyDown={noop}
              onResizeKeyUp={noop}
              frameChoices={[]}
              structured={false}
              onMoveToFrame={noop}
            />
          );
        })}
      </div>
      {focusNode ? (
        <div data-shared-overlay data-shared-scroll>
          <FocusOverlay
            node={{ ...focusNode, ownership: "teammate" }}
            item={focusItem}
            origin={origin}
            readOnly
            filePreview={focusItem ? board.filePreviews[focusItem.id] : undefined}
            onSummarize={noop}
            onBranch={noop}
            onClose={() => { setFocusId(null); setOrigin(null); }}
          />
        </div>
      ) : null}
    </div>
  );
}
