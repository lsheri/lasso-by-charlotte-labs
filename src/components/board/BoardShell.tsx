/**
 * P1: the board shell.
 *
 * One board surface, for every page that wants one. It owns only what is
 * board-generic: the paper and its grid, pan and zoom, wheel handling, pointer
 * drag panning, space to pan, the viewport fit on mount and on resize, a
 * toolbar slot, and the frame and node render layers.
 *
 * It owns nothing of the engagement workboard: no fetching, no save path, no
 * workboard DTO, no region drawing or naming or claiming, no Add work, no Ask,
 * no Details. Those stay in CanvasLabPage.
 *
 * It wires the SAME primitives CanvasLabPage wires, from the same modules, so
 * the two cannot drift into two different boards. That sameness is asserted by
 * src/lib/__tests__/p1-board-shell-lane.test.tsx.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { fitWorkboardViewport, viewportSizeChanged, type LabViewportSize } from "@/components/canvas-lab/canvas-lab-model";
import { dragTo, keyTo, type Point } from "@/lib/canvas-drag";
import { clampZoom, scrollableUnder, stepZoom, wheelPanVector, workboardPinchZoom, zoomAbout } from "@/lib/canvas-zoom";
import {
  isLaneFrameId,
  laneContentExtent,
  laneContentLayout,
  laneVisiblePlacements,
  type LaneContent,
  type LaneContentPlacement,
} from "@/lib/board-lane";
import { cn } from "@/lib/utils";

import { BoardViewControls } from "./BoardViewControls";

export type BoardShellFrame = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional furniture kept outside a lane's scrolling content well. */
  contentInset?: { top?: number; bottom?: number } | undefined;
};

export type BoardShellNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** A node sitting in a lane names that lane here; the lane places it. */
  frame?: string | null | undefined;
};

export type BoardShellProps<F extends BoardShellFrame, N extends BoardShellNode> = {
  frames: readonly F[];
  nodes: readonly N[];
  /** Painted behind the nodes. A lane's own rectangle is drawn by the shell. */
  renderFrame?: ((frame: F) => ReactNode) | undefined;
  renderNode: (node: N) => ReactNode;
  /** Measured heights, for the fit, exactly as the workboard passes them. */
  measuredHeights?: ReadonlyMap<string, number> | undefined;
  /** Sits above the surface, unstyled by the shell beyond its row. */
  toolbar?: ReactNode;
  /** Shows the shared Fit and zoom controls in the toolbar row. */
  showViewControls?: boolean | undefined;
  /** Keeps Fit visible while omitting the zoom cluster. */
  showZoomControls?: boolean | undefined;
  /** Holds this board at 100% while leaving every pan path available. */
  lockZoom?: boolean | undefined;
  /** Given only when nodes may be moved. Lane contents are never offered it. */
  onNodeMove?: ((id: string, to: Point) => void) | undefined;
  selectedIds?: readonly string[] | undefined;
  onSelectNode?: ((id: string | null) => void) | undefined;
  /** Fit again whenever this changes, the way a first load does. */
  fitKey?: string | number | undefined;
  /** Optional subset used only for the initial fit; every frame still renders. */
  fitFrameIds?: readonly string[] | undefined;
  /** Reports this shell's own measured viewport without changing board geometry. */
  onViewportSizeChange?: ((size: LabViewportSize) => void) | undefined;
  className?: string | undefined;
  ariaLabel?: string | undefined;
};

type Interaction = "idle" | "pan" | "drag";

export function BoardShell<F extends BoardShellFrame, N extends BoardShellNode>({
  frames,
  nodes,
  renderFrame,
  renderNode,
  measuredHeights,
  toolbar,
  showViewControls = false,
  showZoomControls = true,
  lockZoom = false,
  onNodeMove,
  selectedIds,
  onSelectNode,
  fitKey,
  fitFrameIds,
  onViewportSizeChange,
  className,
  ariaLabel = "Board",
}: BoardShellProps<F, N>) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [interaction, setInteraction] = useState<Interaction>("idle");
  const [viewportSize, setViewportSize] = useState<LabViewportSize | null>(null);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const lockZoomRef = useRef(lockZoom);
  lockZoomRef.current = lockZoom;
  const spaceRef = useRef(false);
  const panDragRef = useRef<{ pointer: Point; pan: Point } | null>(null);
  const nodeDragRef = useRef<{ id: string; pointer: Point; origin: Point } | null>(null);
  const touchPointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; centre: Point; pan: Point; zoom: number } | null>(null);
  const observedSizeRef = useRef<LabViewportSize | null>(null);
  const onViewportSizeChangeRef = useRef(onViewportSizeChange);
  onViewportSizeChangeRef.current = onViewportSizeChange;

  const laneIds = useMemo(() => new Set(frames.filter((frame) => isLaneFrameId(frame.id)).map((frame) => frame.id)), [frames]);
  const inLane = useCallback((node: N) => Boolean(node.frame && laneIds.has(node.frame)), [laneIds]);

  /** Board nodes only. A lane's contents are placed by the lane, not by x/y. */
  const boardNodes = useMemo(() => nodes.filter((node) => !inLane(node)), [nodes, inLane]);
  const fitFrames = useMemo(() => {
    if (!fitFrameIds) return frames;
    const included = new Set(fitFrameIds);
    return frames.filter((frame) => included.has(frame.id));
  }, [fitFrameIds, frames]);

  // ---- the fit, on mount and on every viewport change -------------------

  const fit = useCallback((reportedViewport?: LabViewportSize) => {
    if (lockZoomRef.current) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const shell = shellRef.current;
    if (!shell) return;
    const viewport = reportedViewport ?? observedSizeRef.current ?? { width: shell.clientWidth, height: shell.clientHeight };
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const result = fitWorkboardViewport(
      viewport,
      [...fitFrames],
      [...boardNodes],
      measuredHeights ?? new Map<string, number>(),
      null,
    );
    setZoom(result.zoom);
    setPan(result.pan);
  }, [fitFrames, boardNodes, measuredHeights]);

  const fitRef = useRef(fit);
  fitRef.current = fit;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (shell) {
      // The last box the observer reported is the truest one; the element's own
      // clientWidth can lag it, and reporting the lagging number would walk the
      // page's width state backwards.
      const size = observedSizeRef.current ?? { width: shell.clientWidth, height: shell.clientHeight };
      if (size.width > 0 && size.height > 0) onViewportSizeChangeRef.current?.(size);
    }
    fitRef.current();
  }, [fitKey]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries?.find((candidate) => candidate.target === shell) ?? entries?.[0];
      const next = entry
        ? { width: entry.contentRect.width, height: entry.contentRect.height }
        : { width: shell.clientWidth, height: shell.clientHeight };
      if (!viewportSizeChanged(observedSizeRef.current, next)) return;
      observedSizeRef.current = next;
      setViewportSize(next);
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  // Report a genuine size change first so consumers can rebuild viewport-sized
  // frames before this shell fits them. Content identity stays out of both
  // dependencies, so an ordinary re-render cannot snap a hand-moved board.
  useLayoutEffect(() => {
    if (!viewportSize) return;
    onViewportSizeChangeRef.current?.(viewportSize);
  }, [viewportSize]);

  useEffect(() => {
    if (!viewportSize) return;
    // The next frame gives a consumer's viewport-size state update time to
    // rebuild geometry before fitRef reads it. Without this, a responsive frame
    // can be visibly correct while the fit still reflects its previous size.
    const schedule = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
    const cancel = typeof cancelAnimationFrame === "function"
      ? cancelAnimationFrame
      : window.clearTimeout;
    const request = schedule(() => fitRef.current(viewportSize));
    return () => cancel(request);
  }, [viewportSize]);

  // ---- the wheel: zoom under the cursor, or pan, or let a lane scroll ----

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const onSurfaceWheel = (event: WheelEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const delta = wheelPanVector(event);
      // A lane scrolls itself. Scrolling a lane never pans the board.
      if (!event.ctrlKey && !event.metaKey && scrollableUnder(target, shell, delta)) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        if (lockZoomRef.current) return;
        const rect = shell.getBoundingClientRect();
        const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const current = zoomRef.current;
        const next = workboardPinchZoom(current, event.deltaY, event.deltaMode);
        setPan((pan) => zoomAbout(pan, current, next, cursor));
        setZoom(next);
        return;
      }
      setPan((current) => ({ x: current.x - delta.x, y: current.y - delta.y }));
    };
    shell.addEventListener("wheel", onSurfaceWheel, { passive: false });
    return () => shell.removeEventListener("wheel", onSurfaceWheel);
  }, []);

  // ---- keyboard: space pans, arrows nudge, +/- zoom ----------------------

  const zoomAtCentre = useCallback((direction: "in" | "out" | 1) => {
    if (lockZoomRef.current) return;
    const shell = shellRef.current;
    const current = zoomRef.current;
    const next = direction === 1 ? clampZoom(1) : stepZoom(current, direction);
    if (!shell) {
      setZoom(next);
      return;
    }
    const centre = { x: shell.clientWidth / 2, y: shell.clientHeight / 2 };
    setPan((pan) => zoomAbout(pan, current, next, centre));
    setZoom(next);
  }, []);

  useLayoutEffect(() => {
    if (!lockZoom) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [lockZoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const shell = shellRef.current;
      const typing = active && active !== document.body && active !== shell && /input|textarea|select/i.test(active.tagName);
      if (typing || active?.isContentEditable) return;
      if (event.code === "Space") {
        spaceRef.current = true;
        return;
      }
      if (event.key === "0" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        zoomAtCentre(1);
        return;
      }
      if ((event.key === "+" || event.key === "=") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        zoomAtCentre("in");
        return;
      }
      if (event.key === "-" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        zoomAtCentre("out");
        return;
      }
      if (event.key === "Escape") {
        onSelectNode?.(null);
        return;
      }
      const selected = selectedIds?.[0];
      if (!selected || !onNodeMove) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const node = boardNodes.find((candidate) => candidate.id === selected);
      if (!node) return;
      event.preventDefault();
      onNodeMove(node.id, keyTo({ x: node.x, y: node.y }, event.key, event.shiftKey));
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [boardNodes, onNodeMove, onSelectNode, selectedIds, zoomAtCentre]);

  // ---- pointer: pan the board, or drag a board node ----------------------

  const beginPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") {
        touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPointersRef.current.size >= 2) {
          const [first, second] = [...touchPointersRef.current.values()];
          if (!first || !second) return;
          panDragRef.current = null;
          const rect = shellRef.current?.getBoundingClientRect();
          pinchRef.current = {
            distance: Math.hypot(second.x - first.x, second.y - first.y),
            centre: {
              x: (first.x + second.x) / 2 - (rect?.left ?? 0),
              y: (first.y + second.y) / 2 - (rect?.top ?? 0),
            },
            pan,
            zoom: zoomRef.current,
          };
          setInteraction("pan");
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }
      if (event.button !== 0 && event.button !== 1) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const nodeEl = target?.closest<HTMLElement>("[data-board-node]");
      const laneContent = target?.closest<HTMLElement>("[data-lane-content]");
      const id = nodeEl?.dataset["boardNode"];

      // A lane's contents are never dragged: position inside a lane carries
      // no meaning, so offering the gesture would be a lie.
      if (laneContent) {
        if (id) onSelectNode?.(id);
        return;
      }

      if (id && onNodeMove && !spaceRef.current && event.button === 0) {
        const node = boardNodes.find((candidate) => candidate.id === id);
        if (node) {
          onSelectNode?.(id);
          nodeDragRef.current = { id, pointer: { x: event.clientX, y: event.clientY }, origin: { x: node.x, y: node.y } };
          setInteraction("drag");
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }

      if (!id) onSelectNode?.(null);
      panDragRef.current = { pointer: { x: event.clientX, y: event.clientY }, pan };
      setInteraction("pan");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [boardNodes, onNodeMove, onSelectNode, pan],
  );

  const movePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch" && touchPointersRef.current.has(event.pointerId)) {
        touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const pinch = pinchRef.current;
        if (pinch && touchPointersRef.current.size >= 2) {
          if (lockZoomRef.current) return;
          const [first, second] = [...touchPointersRef.current.values()];
          if (!first || !second || pinch.distance <= 0) return;
          const next = clampZoom(pinch.zoom * Math.hypot(second.x - first.x, second.y - first.y) / pinch.distance);
          setPan(zoomAbout(pinch.pan, pinch.zoom, next, pinch.centre));
          setZoom(next);
          return;
        }
      }
      const panning = panDragRef.current;
      if (panning) {
        setPan({
          x: panning.pan.x + (event.clientX - panning.pointer.x),
          y: panning.pan.y + (event.clientY - panning.pointer.y),
        });
        return;
      }
      const dragging = nodeDragRef.current;
      if (!dragging || !onNodeMove) return;
      const scale = zoomRef.current || 1;
      const delta = { x: (event.clientX - dragging.pointer.x) / scale, y: (event.clientY - dragging.pointer.y) / scale };
      onNodeMove(dragging.id, dragTo(dragging.origin, delta));
    },
    [onNodeMove],
  );

  const endPointer = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (event?.pointerType === "touch") touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
    panDragRef.current = null;
    nodeDragRef.current = null;
    setInteraction("idle");
  }, []);

  // ---- layers ------------------------------------------------------------

  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  const lanes = useMemo(() => frames.filter((frame) => isLaneFrameId(frame.id)), [frames]);
  const plainFrames = useMemo(() => frames.filter((frame) => !isLaneFrameId(frame.id)), [frames]);

  return (
    <div
      ref={shellRef}
      data-testid="board-shell"
      data-interaction={interaction}
      aria-label={ariaLabel}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      {toolbar || showViewControls ? (
        <div data-testid="board-shell-toolbar" className="absolute inset-x-0 top-0 z-20 flex min-w-0 items-center gap-2 overflow-hidden px-3 py-2">
          {toolbar}
          {showViewControls ? (
            <BoardViewControls
              zoom={zoom}
              showZoomControls={showZoomControls && !lockZoom}
              onFit={() => fitRef.current()}
              onZoomOut={() => zoomAtCentre("out")}
              onResetZoom={() => zoomAtCentre(1)}
              onZoomIn={() => zoomAtCentre("in")}
            />
          ) : null}
        </div>
      ) : null}
      <div
        className="canvas-lab-surface absolute inset-0 touch-none"
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          data-testid="board-shell-stage"
          className="canvas-lab-stage absolute left-0 top-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {plainFrames.map((frame) => (
            <div
              key={frame.id}
              data-board-frame={frame.id}
              className="absolute"
              style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
            >
              {renderFrame ? renderFrame(frame) : null}
            </div>
          ))}

          {lanes.map((lane) => (
            <BoardLane
              key={lane.id}
              lane={lane}
              contents={nodes.filter((node) => node.frame === lane.id)}
              selected={selected}
              renderNode={renderNode}
              {...(renderFrame ? { frameChrome: renderFrame(lane) } : {})}
            />
          ))}

          {boardNodes.map((node) => (
            <div
              key={node.id}
              data-board-node={node.id}
              data-selected={selected.has(node.id) ? "true" : "false"}
              className="absolute"
              style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
            >
              {renderNode(node)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** How many items past each visible edge stay mounted, so a fast scroll never shows a gap. */
const LANE_OVERSCAN = 1;

type BoardLaneProps<N extends BoardShellNode> = {
  lane: BoardShellFrame;
  contents: readonly N[];
  selected: ReadonlySet<string>;
  renderNode: (node: N) => ReactNode;
  frameChrome?: ReactNode;
};

/**
 * A lane's scrolling box. It renders only the contents its own scrollTop puts
 * in view, plus one item of overscan at each end, behind a full-extent spacer
 * so the scrollbar stays honest. Clipping hides pixels; it does not save the
 * render, and a lane may hold hundreds of items.
 */
function BoardLane<N extends BoardShellNode>({ lane, contents, selected, renderNode, frameChrome }: BoardLaneProps<N>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const contentTop = lane.contentInset?.top ?? 0;
  const contentBottom = lane.contentInset?.bottom ?? 0;

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    // The lane's own box, never the board: scrolling a lane does not pan.
    const onScroll = () => setScrollTop(box.scrollTop);
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => box.removeEventListener("scroll", onScroll);
  }, []);

  const measured = useMemo(
    () => contents.map<LaneContent>((node) => ({ id: node.id, height: node.height })),
    [contents],
  );
  const placements = useMemo(() => laneContentLayout(lane, measured), [lane, measured]);
  const extent = useMemo(() => laneContentExtent(measured), [measured]);

  const rendered = useMemo<LaneContentPlacement[]>(() => {
    const visible = laneVisiblePlacements(lane, placements, scrollTop);
    if (visible.length === 0) return placements.slice(0, Math.min(placements.length, LANE_OVERSCAN));
    const first = visible[0]!.index;
    const last = visible[visible.length - 1]!.index;
    return placements.slice(Math.max(0, first - LANE_OVERSCAN), last + 1 + LANE_OVERSCAN);
  }, [lane, placements, scrollTop]);

  return (
    <div
      data-board-lane={lane.id}
      className="absolute"
      style={{ left: lane.x, top: lane.y, width: lane.width, height: lane.height }}
    >
      {frameChrome ?? null}
      <div
        ref={scrollRef}
        data-testid={`board-lane-scroll-${lane.id}`}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
        // Inline, so the lane's own scrolling is a fact of the element
        // rather than a stylesheet scrollableUnder may not have read.
        style={{ top: contentTop, bottom: contentBottom, overflowY: "auto", overflowX: "hidden" }}
      >
        <div className="relative w-full" style={{ height: extent }}>
          {rendered.map((placement) => {
            const node = contents[placement.index];
            if (!node) return null;
            return (
              <div
                key={node.id}
                data-lane-content={node.id}
                data-board-node={node.id}
                data-selected={selected.has(node.id) ? "true" : "false"}
                className="absolute"
                style={{ left: placement.x, top: placement.y, width: placement.width, height: placement.height }}
              >
                {renderNode(node)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
