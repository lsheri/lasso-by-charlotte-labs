import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { WorkNote } from "@/components/work/WorkNote";
import { useReducedMotion } from "@/hooks/use-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  NODE_H_DELIVERABLE,
  NODE_H_SOURCE,
  NODE_W_DELIVERABLE,
  NODE_W_SOURCE,
  seedLayout,
  type Placed,
} from "@/lib/canvas-layout";
import {
  DRAG_HOLD_MS,
  dragTo,
  keyTo,
  passedSlop,
  snapPoint,
  type Point,
} from "@/lib/canvas-drag";
import {
  LINK_HANDLE_R,
  canLink,
  handlePoints,
  nearestTarget,
  type LinkCandidate,
} from "@/lib/canvas-link";
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  pinchZoom,
  stepZoom,
} from "@/lib/canvas-zoom";
import { logEvent } from "@/lib/telemetry";
import { drawCanvasLinkFn } from "@/lib/canvas-link.functions";
import { placeCanvasNodeFn } from "@/lib/canvas-node.functions";
import { useProfile } from "@/hooks/use-profile";
import { noteCanvasOpenedFn } from "@/lib/canvas.functions";
import { isDeliverableType, type LineageStatus } from "@/lib/lineage-shared";
import { reviewLink } from "@/lib/lineage.functions";
import type { WorkItemRow } from "@/lib/work-types";

type CanvasLink = {
  id: string;
  from_item_id: string;
  to_item_id: string;
  relation: string;
  status: LineageStatus;
  /** "model" traced it, "person" drew it. Never blur the two. */
  source: string;
};

type CanvasRead = {
  positions: { work_item_id: string; x: number; y: number }[];
  links: CanvasLink[];
};


type NodePosition = Placed & { stored: boolean };

function nodeSize(kind: Placed["kind"]) {
  return kind === "deliverable"
    ? { width: NODE_W_DELIVERABLE, height: NODE_H_DELIVERABLE }
    : { width: NODE_W_SOURCE, height: NODE_H_SOURCE };
}

function curveFor(source: NodePosition, target: NodePosition, yOffset = 0) {
  const sourceSize = nodeSize(source.kind);
  const targetSize = nodeSize(target.kind);
  const sx = source.x + sourceSize.width / 2;
  const sy = source.y + sourceSize.height / 2 + yOffset;
  const tx = target.x + targetSize.width / 2;
  const ty = target.y + targetSize.height / 2 + yOffset;
  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.hypot(dx, dy) || 1;
  const cx = (sx + tx) / 2 - (dy / length) * 28;
  const cy = (sy + ty) / 2 + (dx / length) * 28;
  const angle = Math.atan2(ty - cy, tx - cx);
  const wing = 8;
  const spread = 0.55;
  const arrowA = `${tx - Math.cos(angle - spread) * wing},${ty - Math.sin(angle - spread) * wing}`;
  const arrowB = `${tx - Math.cos(angle + spread) * wing},${ty - Math.sin(angle + spread) * wing}`;
  return {
    path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,
    arrow: `M ${arrowA} L ${tx},${ty} L ${arrowB}`,
    quad: { sx, sy, cx, cy, tx, ty },
    // The quadratic midpoint, where a question about this line is anchored.
    mid: { x: 0.25 * sx + 0.5 * cx + 0.25 * tx, y: 0.25 * sy + 0.5 * cy + 0.25 * ty },
  };
}

/** The same bow the finished lines use, between two loose points. */
function bowFor(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const cx = (from.x + to.x) / 2 - (dy / length) * 28;
  const cy = (from.y + to.y) / 2 + (dx / length) * 28;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

/**
 * A quadratic redrawn as a pencil line: sampled, then nudged off the true
 * curve by a deterministic wobble, so a line a person drew never reads like a
 * line the model traced.
 */
function pencilPath(quad: { sx: number; sy: number; cx: number; cy: number; tx: number; ty: number }, seed: string) {
  const steps = 14;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  const parts: string[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const inverse = 1 - t;
    const x = inverse * inverse * quad.sx + 2 * inverse * t * quad.cx + t * t * quad.tx;
    const y = inverse * inverse * quad.sy + 2 * inverse * t * quad.cy + t * t * quad.ty;
    const wobble = Math.sin((step + hash) * 1.7) * 1.15 * Math.sin(Math.PI * t);
    const dx = quad.tx - quad.sx;
    const dy = quad.ty - quad.sy;
    const length = Math.hypot(dx, dy) || 1;
    const px = x - (dy / length) * wobble;
    const py = y + (dx / length) * wobble;
    parts.push(`${step === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return parts.join(" ");
}

/** The relation words a drafted link can carry. */
const RELATION_WORDS = new Set(["informed", "produced", "revised", "cited"]);

/** Is this client point inside the given element? */
function isOver(element: HTMLElement | null, x: number, y: number) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}


function CanvasNode({
  item,
  position,
  onOpen,
  offset,
  lifted,
  grabbed,
  onGrabPointer,
  onNodeKeyDown,
  suppressClickRef,
  onLinkPointer,
  outlined,
}: {
  item: WorkItemRow;
  position: NodePosition;
  onOpen: (item: WorkItemRow) => void;
  offset: Point | null;
  lifted: boolean;
  grabbed: boolean;
  onGrabPointer: (id: string, event: React.PointerEvent) => void;
  onNodeKeyDown: (id: string, event: React.KeyboardEvent) => void;
  suppressClickRef: React.MutableRefObject<boolean>;
  onLinkPointer: (id: string, from: Point, event: React.PointerEvent) => void;
  outlined: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const size = nodeSize(position.kind);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Handles are decoration until pressed, and never while the note is moving.
  const showHandles = (hovered || focused) && !lifted && !grabbed;
  const handles = handlePoints({ x: 0, y: 0, w: size.width, h: size.height });

  return (
    <div
      className="absolute"
      tabIndex={0}
      aria-label={item.title ?? "Untitled"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        minHeight: size.height,
        zIndex: lifted || grabbed ? 10 : 1,
        transform: offset
          ? `translate(${offset.x}px, ${offset.y}px)${lifted && !reduceMotion ? " scale(1.03)" : ""}`
          : undefined,
        boxShadow: lifted && !reduceMotion ? "var(--shadow-modal)" : undefined,
        outline: grabbed || outlined ? "1.4px solid var(--nb-graphite)" : undefined,
        touchAction: "none",
        cursor: lifted ? "grabbing" : "grab",
      }}
      onPointerDown={(event) => onGrabPointer(position.id, event)}
      onKeyDown={(event) => onNodeKeyDown(position.id, event)}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <WorkNote item={item} onOpen={() => onOpen(item)} className="h-full" />
      {showHandles ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.width}
          height={size.height}
        >
          {handles.map((handle, index) => (
            <circle
              key={index}
              cx={handle.x}
              cy={handle.y}
              r={LINK_HANDLE_R}
              fill="none"
              stroke="var(--nb-pencil)"
              strokeWidth="1.2"
              strokeDasharray="2 2"
              style={{ pointerEvents: "all", cursor: "crosshair" }}
              onPointerDown={(event) => {
                // Pressing a handle draws a line. It must never start a move.
                event.stopPropagation();
                event.preventDefault();
                onLinkPointer(
                  position.id,
                  { x: position.x + handle.x, y: position.y + handle.y },
                  event,
                );
              }}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

/** A picture of which in-scope work fed each deliverable, and where it sits. */
export function EngagementCanvasView({
  engagementId,
  items,
  onOpen,
}: {
  engagementId: string;
  items: WorkItemRow[];
  onOpen: (item: WorkItemRow) => void;
}) {
  const { data: profile } = useProfile();
  const noteOpened = useServerFn(noteCanvasOpenedFn);
  const placeNode = useServerFn(placeCanvasNodeFn);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemKey = itemIds.join(":");
  const { data } = useQuery({
    queryKey: ["engagement-canvas", engagementId, itemKey],
    enabled: Boolean(engagementId),
    queryFn: async (): Promise<CanvasRead> => {
      const [positionsResult, linksResult] = await Promise.all([
        supabase
          .from("canvas_nodes")
          .select("work_item_id, x, y")
          .eq("engagement_id", engagementId),
        itemIds.length
          ? supabase
              .from("work_item_links")
              .select("id, from_item_id, to_item_id, relation, status, source")
              .in("from_item_id", itemIds)
              .in("to_item_id", itemIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (positionsResult.error) throw positionsResult.error;
      if (linksResult.error) throw linksResult.error;
      return {
        positions: positionsResult.data ?? [],
        links: (linksResult.data ?? []) as CanvasLink[],
      };
    },
  });

  const layout = useMemo(() => {
    const links = (data?.links ?? []).filter((link) => link.status !== "discarded");
    const linksBySource = new Map<string, string[]>();
    for (const link of links) {
      linksBySource.set(link.from_item_id, [
        ...(linksBySource.get(link.from_item_id) ?? []),
        link.to_item_id,
      ]);
    }
    const seeded = seedLayout({
      deliverables: items.filter((item) => isDeliverableType(item.type)).map((item) => item.id),
      linksBySource,
    });
    const positions = new Map<string, NodePosition>(
      seeded.map((position) => [position.id, { ...position, stored: false }]),
    );
    for (const row of data?.positions ?? []) {
      const item = items.find((candidate) => candidate.id === row.work_item_id);
      if (!item) continue;
      positions.set(row.work_item_id, {
        id: row.work_item_id,
        x: row.x,
        y: row.y,
        kind: isDeliverableType(item.type) ? "deliverable" : "source",
        stored: true,
      });
    }
    return { links, positions };
  }, [data, items]);

  /**
   * Moves made in this session, drawn before the server confirms them. A null
   * entry means the item went back to the shelf: the shelf is the unplaced
   * state, not a container.
   */
  const [moves, setMoves] = useState<Record<string, Point | null>>({});

  const view = useMemo(() => {
    const positions = new Map(layout.positions);
    for (const [id, point] of Object.entries(moves)) {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) continue;
      if (point === null) positions.delete(id);
      else
        positions.set(id, {
          id,
          x: point.x,
          y: point.y,
          kind: isDeliverableType(item.type) ? "deliverable" : "source",
          stored: true,
        });
    }
    const placed = Array.from(positions.values());
    const placedIds = new Set(placed.map((position) => position.id));
    return {
      placed,
      positions,
      links: layout.links.filter(
        (link) => placedIds.has(link.from_item_id) && placedIds.has(link.to_item_id),
      ),
      shelf: items.filter((item) => !placedIds.has(item.id)),
    };
  }, [layout, moves, items]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!data || openedRef.current) return;
    openedRef.current = true;
    void noteOpened({
      data: {
        nodes: view.placed.length,
        links: view.links.length,
        shelf: view.shelf.length,
        profile_id: profile?.id,
      },
    }).catch(() => undefined);
  }, [data, view.links.length, view.placed.length, view.shelf.length, noteOpened, profile?.id]);

  const positions = view.positions;
  const width = Math.max(
    880,
    ...view.placed.map((position) => position.x + nodeSize(position.kind).width + 80),
  );
  const height = Math.max(
    560,
    ...view.placed.map((position) => position.y + nodeSize(position.kind).height + 100),
  );

  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const review = useServerFn(reviewLink);
  // An answer already given in this session, drawn before the server confirms it.
  const [answers, setAnswers] = useState<Record<string, "confirmed" | "discarded">>({});
  const [leaving, setLeaving] = useState<string | null>(null);
  const [asking, setAsking] = useState<{
    id: string;
    relation: string;
    x: number;
    y: number;
    kind: "draft" | "person";
  } | null>(null);

  const closeAsking = useCallback(() => setAsking(null), []);
  useEffect(() => {
    if (!asking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAsking();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking, closeAsking]);

  const answer = useCallback(
    async (linkId: string, action: "confirmed" | "discarded") => {
      closeAsking();
      setAnswers((current) => ({ ...current, [linkId]: action }));
      if (action === "discarded" && !reduceMotion) {
        setLeaving(linkId);
        window.setTimeout(() => setLeaving((id) => (id === linkId ? null : id)), 240);
      }
      try {
        await review({ data: { link_id: linkId, action, surface: "canvas" } });
        await queryClient.invalidateQueries({ queryKey: ["engagement-canvas", engagementId] });
      } catch (error) {
        setAnswers((current) => {
          const next = { ...current };
          delete next[linkId];
          return next;
        });
        setLeaving((id) => (id === linkId ? null : id));
        toast.error(error instanceof Error ? error.message : "That did not save.");
      }
    },
    [closeAsking, engagementId, queryClient, reduceMotion, review],
  );

  // ---- zoom ---------------------------------------------------------------
  // Positions, deltas and hit testing are canvas units. Pointer events are
  // screen pixels. At any zoom but 1 those are different units, so every
  // pointer measure is divided by the zoom before it reaches canvas maths.
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const orgId = profile?.org_id;
  const noteZoom = useCallback(
    (direction: "in" | "out" | "reset", method: "pinch" | "button" | "keyboard") => {
      if (!orgId) return;
      logEvent("canvas.zoomed", orgId, { direction, method });
    },
    [orgId],
  );
  // One continuous pinch is one gesture, so it records once, on the tail.
  const pinchTimerRef = useRef<number | null>(null);
  const notePinch = useCallback(
    (direction: "in" | "out") => {
      if (pinchTimerRef.current !== null) window.clearTimeout(pinchTimerRef.current);
      pinchTimerRef.current = window.setTimeout(() => {
        pinchTimerRef.current = null;
        noteZoom(direction, "pinch");
      }, 600);
    },
    [noteZoom],
  );
  useEffect(
    () => () => {
      if (pinchTimerRef.current !== null) window.clearTimeout(pinchTimerRef.current);
    },
    [],
  );
  const zoomBy = useCallback(
    (direction: "in" | "out" | "reset", method: "button" | "keyboard") => {
      setZoom((current) => (direction === "reset" ? ZOOM_DEFAULT : stepZoom(current, direction)));
      noteZoom(direction, method);
    },
    [noteZoom],
  );
  // A pinch is a wheel event with ctrl or cmd held. Without preventDefault the
  // browser zooms the whole page instead, so the listener is non-passive.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      if (delta === 0) return;
      setZoom((current) => pinchZoom(current, delta));
      notePinch(delta < 0 ? "in" : "out");
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [notePinch]);


  // ---- moving work ------------------------------------------------------
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const shelfRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<{
    id: string;
    origin: Point | null;
    /** Canvas units. */
    delta: Point;
    /** Screen pixels, for the shelf, which sits outside the scaled surface. */
    screen: Point;
    lifted: boolean;
    overShelf: boolean;
  } | null>(null);
  const [grabbed, setGrabbed] = useState<{ id: string; start: Point | null } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // ---- drawing a connection ---------------------------------------------
  const drawLink = useServerFn(drawCanvasLinkFn);
  /** Edges drawn in this session, shown before the server confirms them. */
  const [drawn, setDrawn] = useState<CanvasLink[]>([]);
  const [linkDrag, setLinkDrag] = useState<{
    fromId: string;
    from: Point;
    to: Point;
    targetId: string | null;
  } | null>(null);
  /** The keyboard path: linking from one node, stepping through the others. */
  const [linkKeys, setLinkKeys] = useState<{ fromId: string; index: number } | null>(null);

  const titleOf = useCallback(
    (id: string) => items.find((candidate) => candidate.id === id)?.title ?? "this",
    [items],
  );

  const existingLinks = useMemo(
    () =>
      [...view.links, ...drawn].map((link) => ({
        from_item_id: link.from_item_id,
        to_item_id: link.to_item_id,
        relation: link.relation,
        status: answers[link.id] ?? link.status,
      })),
    [view.links, drawn, answers],
  );

  const candidatesFor = useCallback(
    (fromId: string): LinkCandidate[] =>
      view.placed
        .filter((position) => position.id !== fromId)
        .map((position) => {
          const size = nodeSize(position.kind);
          return { id: position.id, x: position.x, y: position.y, w: size.width, h: size.height };
        }),
    [view.placed],
  );

  const commitLink = useCallback(
    async (fromId: string, toId: string) => {
      const optimisticId = `drawn:${fromId}:${toId}`;
      setDrawn((current) => [
        ...current.filter((link) => link.id !== optimisticId),
        {
          id: optimisticId,
          from_item_id: fromId,
          to_item_id: toId,
          relation: "informed",
          status: "confirmed" as LineageStatus,
          source: "person",
        },
      ]);
      try {
        await drawLink({
          data: {
            engagement_id: engagementId,
            from_item_id: fromId,
            to_item_id: toId,
            profile_id: profile?.id,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["engagement-canvas", engagementId] });
        setDrawn((current) => current.filter((link) => link.id !== optimisticId));
      } catch (error) {
        setDrawn((current) => current.filter((link) => link.id !== optimisticId));
        toast.error(error instanceof Error ? error.message : "That did not save.");
      }
    },
    [drawLink, engagementId, profile?.id, queryClient],
  );

  const startLinkPointer = useCallback(
    (fromId: string, from: Point, event: React.PointerEvent) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const candidates = candidatesFor(fromId);
      const toSurface = (clientX: number, clientY: number) => {
        const rect = surface.getBoundingClientRect();
        // Screen pixels into canvas units, so nearestTarget and LINK_SNAP,
        // which are canvas units, still mean what they say at any zoom.
        const zoom = zoomRef.current;
        return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
      };
      setLinkDrag({ fromId, from, to: toSurface(event.clientX, event.clientY), targetId: null });

      const finish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", finish);
        setLinkDrag(null);
      };

      function onMove(moveEvent: PointerEvent) {
        moveEvent.preventDefault();
        const point = toSurface(moveEvent.clientX, moveEvent.clientY);
        const target = nearestTarget(point, candidates);
        setLinkDrag((current) =>
          current ? { ...current, to: point, targetId: target ? target.id : null } : current,
        );
      }

      function onUp(upEvent: PointerEvent) {
        const point = toSurface(upEvent.clientX, upEvent.clientY);
        const target = nearestTarget(point, candidates);
        finish();
        // Released over empty paper: nothing written, nothing recorded.
        if (!target) return;
        const reason = canLink(fromId, target.id, existingLinks);
        // Refusals are quiet during the drag and spoken only on release.
        if (reason) {
          toast(reason);
          return;
        }
        void commitLink(fromId, target.id);
      }

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", finish);
    },
    [candidatesFor, commitLink, existingLinks],
  );


  /** The one commit path. Position only: never membership, never a workstream. */
  const commit = useCallback(
    async (
      id: string,
      point: Point | null,
      from: "shelf" | "canvas",
      method: "pointer" | "keyboard",
    ) => {
      const previous = moves[id];
      setMoves((current) => ({ ...current, [id]: point }));
      try {
        await placeNode({
          data: {
            engagement_id: engagementId,
            work_item_id: id,
            x: point ? point.x : null,
            y: point ? point.y : null,
            from,
            method,
            profile_id: profile?.id,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["engagement-canvas", engagementId] });
      } catch (error) {
        setMoves((current) => {
          const next = { ...current };
          if (previous === undefined) delete next[id];
          else next[id] = previous;
          return next;
        });
        toast.error(error instanceof Error ? error.message : "That did not save.");
      }
    },
    [engagementId, moves, placeNode, queryClient, profile?.id],
  );

  const startPointerDrag = useCallback(
    (id: string, event: React.PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const origin = positions.get(id) ?? null;
      const startX = event.clientX;
      const startY = event.clientY;
      let lifted = false;
      const lift = () => {
        if (lifted) return;
        lifted = true;
        suppressClickRef.current = true;
        setDrag((current) => (current && current.id === id ? { ...current, lifted: true } : current));
      };
      const hold = window.setTimeout(lift, DRAG_HOLD_MS);
      setDrag({
        id,
        origin: origin ? { x: origin.x, y: origin.y } : null,
        delta: { x: 0, y: 0 },
        lifted: false,
        overShelf: false,
      });

      const finish = () => {
        window.clearTimeout(hold);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        setDrag(null);
      };

      function onMove(moveEvent: PointerEvent) {
        const delta = { x: moveEvent.clientX - startX, y: moveEvent.clientY - startY };
        if (passedSlop(delta)) lift();
        if (!lifted) return;
        moveEvent.preventDefault();
        const overShelf = isOver(shelfRef.current, moveEvent.clientX, moveEvent.clientY);
        setDrag((current) =>
          current && current.id === id ? { ...current, delta, lifted: true, overShelf } : current,
        );
      }

      function onUp(upEvent: PointerEvent) {
        const wasLifted = lifted;
        const delta = { x: upEvent.clientX - startX, y: upEvent.clientY - startY };
        finish();
        if (!wasLifted) return;
        const overShelf = isOver(shelfRef.current, upEvent.clientX, upEvent.clientY);
        if (origin) {
          if (overShelf) {
            void commit(id, null, "canvas", "pointer");
            return;
          }
          void commit(id, dragTo({ x: origin.x, y: origin.y }, delta), "canvas", "pointer");
          return;
        }
        const surface = surfaceRef.current;
        if (!surface || !isOver(surface, upEvent.clientX, upEvent.clientY)) return;
        const rect = surface.getBoundingClientRect();
        void commit(
          id,
          snapPoint({ x: upEvent.clientX - rect.left, y: upEvent.clientY - rect.top }),
          "shelf",
          "pointer",
        );
      }

      function onCancel() {
        finish();
      }

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [commit, positions],
  );

  const onNodeKeyDown = useCallback(
    (id: string, event: React.KeyboardEvent) => {
      const current = positions.get(id);
      const item = items.find((candidate) => candidate.id === id);
      const name = item?.title ?? "this";

      // The keyboard path for drawing, mirroring grab and move.
      const linkCandidates = candidatesFor(id);
      if (linkKeys?.fromId === id) {
        const target = linkCandidates[linkKeys.index];
        if (
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight"
        ) {
          event.preventDefault();
          if (linkCandidates.length === 0) return;
          const step = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
          const next =
            (linkKeys.index + step + linkCandidates.length) % linkCandidates.length;
          setLinkKeys({ fromId: id, index: next });
          const candidate = linkCandidates[next];
          setAnnouncement(candidate ? titleOf(candidate.id) : "");
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          setLinkKeys(null);
          if (!target) return;
          const reason = canLink(id, target.id, existingLinks);
          if (reason) {
            setAnnouncement(reason);
            toast(reason);
            return;
          }
          setAnnouncement(`Connected ${name} to ${titleOf(target.id)}.`);
          void commitLink(id, target.id);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setLinkKeys(null);
          setAnnouncement("Stopped drawing. Nothing was connected.");
          return;
        }
      }
      if ((event.key === "l" || event.key === "L") && !grabbed) {
        event.preventDefault();
        if (linkCandidates.length === 0) {
          setAnnouncement("There is nothing else in the picture to connect to.");
          return;
        }
        setLinkKeys({ fromId: id, index: 0 });
        const first = linkCandidates[0];
        setAnnouncement(
          `Drawing from ${name} to ${first ? titleOf(first.id) : "this"}. Arrow keys to choose, Enter to connect, Escape to stop.`,
        );
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        if (grabbed?.id === id) return;
        setGrabbed({ id, start: current ? { x: current.x, y: current.y } : null });
        setAnnouncement(
          `Grabbed ${name}. Use the arrow keys, then Enter to drop, Escape to cancel.`,
        );
        return;
      }
      if (grabbed?.id !== id) return;
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        if (!current) return;
        setMoves((all) => ({
          ...all,
          [id]: keyTo({ x: current.x, y: current.y }, event.key as "ArrowUp", event.shiftKey),
        }));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        setGrabbed(null);
        if (current) void commit(id, { x: current.x, y: current.y }, "canvas", "keyboard");
        setAnnouncement(`Placed ${name}.`);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const start = grabbed.start;
        setMoves((all) => {
          const next = { ...all };
          if (start) next[id] = start;
          else delete next[id];
          return next;
        });
        setGrabbed(null);
        setAnnouncement(`Left ${name} where it was.`);
      }
    },
    [
      candidatesFor,
      commit,
      commitLink,
      existingLinks,
      grabbed,
      items,
      linkKeys,
      positions,
      titleOf,
    ],
  );

  const placedNow = new Set(view.placed.map((position) => position.id));
  const allLinks = [
    ...view.links,
    ...drawn.filter(
      (link) =>
        placedNow.has(link.from_item_id) &&
        placedNow.has(link.to_item_id) &&
        !view.links.some(
          (existing) =>
            existing.from_item_id === link.from_item_id &&
            existing.to_item_id === link.to_item_id &&
            existing.relation === link.relation,
        ),
    ),
  ];
  const visibleLinks = allLinks.filter(
    (link) => (answers[link.id] ?? link.status) !== "discarded" || leaving === link.id,
  );
  const draftCount = visibleLinks.filter(
    (link) => (answers[link.id] ?? link.status) === "draft",
  ).length;

  return (
    <section className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {draftCount > 0 ? (
        <p className="font-hand text-[19px] text-graphite">
          {draftCount} question{draftCount === 1 ? "" : "s"} to answer
        </p>
      ) : null}
      <div className="overflow-auto rounded-[6px] border border-[var(--nb-rule)]">
        <div
          ref={surfaceRef}
          className="relative min-h-[560px]"
          onClick={closeAsking}
          style={{
            width,
            height,
            background:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--nb-rule) 70%, var(--nb-paper)) 1px, transparent 0) 0 0/22px 22px var(--nb-paper)",
          }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            width={width}
            height={height}
          >
            {visibleLinks.map((link) => {
              const source = positions.get(link.from_item_id);
              const target = positions.get(link.to_item_id);
              if (!source || !target) return null;
              const curve = curveFor(source, target);
              const offsetCurve = curveFor(source, target, 5);
              const key = link.id;
              const status = answers[link.id] ?? link.status;
              const justConfirmed = answers[link.id] === "confirmed";
              if (status === "discarded" || leaving === link.id) {
                return (
                  <g
                    key={key}
                    fill="none"
                    stroke="var(--nb-pencil)"
                    strokeWidth="1.5"
                    style={{
                      opacity: 0,
                      transition: reduceMotion ? "none" : "opacity 240ms var(--nb-ease)",
                    }}
                  >
                    <path d={curve.path} strokeDasharray="6 7" />
                    <path d={curve.arrow} />
                  </g>
                );
              }
              if (status === "draft") {
                return (
                  <g key={key} fill="none" stroke="var(--nb-pencil)" strokeWidth="1.5">
                    <path d={curve.path} strokeDasharray="6 7" />
                    <path d={curve.arrow} />
                  </g>
                );
              }
              if (link.source === "person") {
                // A person drew this one. It is drawn, not inked, so it can
                // never be mistaken for a line the model traced.
                return (
                  <g
                    key={key}
                    fill="none"
                    stroke="var(--nb-graphite)"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    className={reduceMotion ? undefined : "nb-trail-arrow is-on"}
                  >
                    <path pathLength={1} d={pencilPath(curve.quad, link.id)} />
                    <path pathLength={1} d={curve.arrow} />
                  </g>
                );
              }
              return (
                <g
                  key={key}
                  fill="none"
                  stroke="var(--nb-graphite)"
                  className={justConfirmed ? "nb-trail-arrow is-on" : undefined}
                >
                  <path pathLength={1} d={curve.path} strokeWidth="1.6" />
                  <path pathLength={1} d={offsetCurve.path} strokeWidth="0.7" opacity="0.45" />
                  <path pathLength={1} d={curve.arrow} strokeWidth="1.6" />
                </g>
              );
            })}
          </svg>
          {/* Answerable draft lines: a separate layer, because the drawing above never takes a pointer. */}
          <svg className="absolute inset-0" width={width} height={height} style={{ pointerEvents: "none" }}>
            {visibleLinks.map((link) => {
              const status = answers[link.id] ?? link.status;
              const kind: "draft" | "person" | null =
                status === "draft" ? "draft" : link.source === "person" ? "person" : null;
              // An edge still saving has no row to review yet.
              if (!kind || link.id.startsWith("drawn:")) return null;
              const source = positions.get(link.from_item_id);
              const target = positions.get(link.to_item_id);
              if (!source || !target) return null;
              const curve = curveFor(source, target);
              const sourceTitle = items.find((item) => item.id === link.from_item_id)?.title ?? "this";
              const targetTitle = items.find((item) => item.id === link.to_item_id)?.title ?? "this";
              const relation = RELATION_WORDS.has(link.relation) ? link.relation : "informed";
              const open = (event: { stopPropagation: () => void }) => {
                event.stopPropagation();
                setAsking({ id: link.id, relation, x: curve.mid.x, y: curve.mid.y, kind });
              };
              return (
                <path
                  key={link.id}
                  d={curve.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  pointerEvents="stroke"
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                  role="button"
                  aria-label={
                    kind === "draft"
                      ? `Did "${sourceTitle}" feed "${targetTitle}"?`
                      : `You connected "${sourceTitle}" to "${targetTitle}".`
                  }
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      open(event);
                    }
                  }}
                />
              );
            })}
          </svg>
          {/* The guide while a connection is being drawn. */}
          {linkDrag ? (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              width={width}
              height={height}
            >
              <path
                d={bowFor(
                  linkDrag.from,
                  (() => {
                    if (!linkDrag.targetId) return linkDrag.to;
                    const snapped = positions.get(linkDrag.targetId);
                    if (!snapped) return linkDrag.to;
                    const size = nodeSize(snapped.kind);
                    return { x: snapped.x + size.width / 2, y: snapped.y + size.height / 2 };
                  })(),
                )}
                fill="none"
                stroke="var(--nb-pencil)"
                strokeWidth="1.5"
                strokeDasharray="6 7"
              />
            </svg>
          ) : null}
          {view.placed.map((position) => {
            const item = items.find((candidate) => candidate.id === position.id);
            if (!item) return null;
            const dragging = drag && drag.id === position.id && drag.lifted ? drag : null;
            return (
              <CanvasNode
                key={position.id}
                item={item}
                position={position}
                onOpen={onOpen}
                offset={dragging ? dragging.delta : null}
                lifted={Boolean(dragging)}
                grabbed={grabbed?.id === position.id}
                onGrabPointer={startPointerDrag}
                onNodeKeyDown={onNodeKeyDown}
                suppressClickRef={suppressClickRef}
                onLinkPointer={startLinkPointer}
                outlined={linkDrag?.targetId === position.id}
              />
            );
          })}
          {asking ? (
            <div
              className="absolute rounded-[var(--radius)] border border-[var(--nb-rule)] bg-card px-3 py-2 shadow-[var(--shadow-modal)]"
              style={{ left: asking.x, top: asking.y, zIndex: 20 }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {asking.relation}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {asking.kind === "person" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void answer(asking.id, "discarded")}
                  >
                    Remove
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={() => void answer(asking.id, "confirmed")}>
                      Yes, this fed it
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void answer(asking.id, "discarded")}
                    >
                      No it didn&apos;t
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>


      <div
        ref={shelfRef}
        className="border p-4"
        style={{
          borderColor:
            drag?.lifted && drag.overShelf ? "var(--nb-graphite)" : "var(--nb-rule)",
          background:
            drag?.lifted && drag.overShelf
              ? "color-mix(in oklab, var(--nb-rule) 22%, transparent)"
              : undefined,
        }}
      >
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="font-hand text-[19px]">Not in the picture yet</h2>
          <span className="font-mono text-[9px] text-muted-foreground">{view.shelf.length}</span>
        </div>
        {view.shelf.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {view.shelf.map((item) => {
              const dragging = drag && drag.id === item.id && drag.lifted ? drag : null;
              return (
                <div
                  key={item.id}
                  style={{
                    width: NODE_W_SOURCE,
                    minHeight: NODE_H_SOURCE,
                    touchAction: "none",
                    cursor: dragging ? "grabbing" : "grab",
                    transform: dragging
                      ? `translate(${dragging.delta.x}px, ${dragging.delta.y}px)${reduceMotion ? "" : " scale(1.03)"}`
                      : undefined,
                    boxShadow: dragging && !reduceMotion ? "var(--shadow-modal)" : undefined,
                    zIndex: dragging ? 10 : undefined,
                    position: dragging ? "relative" : undefined,
                  }}
                  onPointerDown={(event) => startPointerDrag(item.id, event)}
                  onClickCapture={(event) => {
                    if (!suppressClickRef.current) return;
                    suppressClickRef.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <WorkNote item={item} onOpen={() => onOpen(item)} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Everything here is in the picture.</p>
        )}
      </div>
    </section>
  );
}
