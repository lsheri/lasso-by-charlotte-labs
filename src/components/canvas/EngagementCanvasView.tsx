import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { WorkNote } from "@/components/work/WorkNote";
import { useReducedMotion } from "@/hooks/use-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  CANVAS_GRID,
  NODE_H_DELIVERABLE,
  NODE_H_SOURCE,
  NODE_W_DELIVERABLE,
  NODE_W_SOURCE,
  seedLayout,
  type Placed,
} from "@/lib/canvas-layout";
import { noteCanvasOpenedFn } from "@/lib/canvas.functions";
import { isDeliverableType, type LineageStatus } from "@/lib/lineage-shared";
import type { WorkItemRow } from "@/lib/work-types";

type CanvasLink = {
  from_item_id: string;
  to_item_id: string;
  status: LineageStatus;
};

type CanvasRead = {
  positions: { work_item_id: string; x: number; y: number }[];
  summaries: Map<string, string>;
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
  };
}

function CanvasNode({
  item,
  position,
  summary,
  onOpen,
}: {
  item: WorkItemRow;
  position: NodePosition;
  summary: string | undefined;
  onOpen: (item: WorkItemRow) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const size = nodeSize(position.kind);

  const cancelTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => cancelTimer, []);

  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        minHeight: size.height,
        zIndex: expanded ? 2 : 1,
        transition: reduceMotion ? "none" : "min-height 160ms var(--nb-ease)",
      }}
      onPointerEnter={(event) => {
        if (!summary || event.pointerType === "touch") return;
        cancelTimer();
        timerRef.current = window.setTimeout(() => setExpanded(true), 180);
      }}
      onPointerLeave={() => {
        cancelTimer();
        setExpanded(false);
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "touch" && summary) {
          event.stopPropagation();
          setExpanded((current) => !current);
        }
      }}
    >
      <WorkNote item={item} onOpen={() => onOpen(item)} className="h-full" />
      {expanded && summary ? (
        <p className="relative -mt-2 px-3 pb-3 text-[11.5px] leading-[17px] text-muted-foreground">
          {summary}
        </p>
      ) : null}
    </div>
  );
}

/** A read-only picture of which in-scope work fed each deliverable. */
export function EngagementCanvasView({
  engagementId,
  items,
  onOpen,
}: {
  engagementId: string;
  items: WorkItemRow[];
  onOpen: (item: WorkItemRow) => void;
}) {
  const noteOpened = useServerFn(noteCanvasOpenedFn);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemKey = itemIds.join(":");
  const { data } = useQuery({
    queryKey: ["engagement-canvas", engagementId, itemKey],
    enabled: Boolean(engagementId),
    queryFn: async (): Promise<CanvasRead> => {
      const [positionsResult, extractsResult, linksResult] = await Promise.all([
        supabase
          .from("canvas_nodes")
          .select("work_item_id, x, y")
          .eq("engagement_id", engagementId),
        itemIds.length
          ? supabase.from("work_item_extracts").select("work_item_id, summary").in("work_item_id", itemIds)
          : Promise.resolve({ data: [], error: null }),
        itemIds.length
          ? supabase
              .from("work_item_links")
              .select("from_item_id, to_item_id, status")
              .in("from_item_id", itemIds)
              .in("to_item_id", itemIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (positionsResult.error) throw positionsResult.error;
      if (extractsResult.error) throw extractsResult.error;
      if (linksResult.error) throw linksResult.error;
      return {
        positions: positionsResult.data ?? [],
        summaries: new Map((extractsResult.data ?? []).map((row) => [row.work_item_id, row.summary])),
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
    const placed = Array.from(positions.values());
    const placedIds = new Set(placed.map((position) => position.id));
    return {
      links: links.filter(
        (link) => placedIds.has(link.from_item_id) && placedIds.has(link.to_item_id),
      ),
      placed,
      shelf: items.filter((item) => !placedIds.has(item.id)),
    };
  }, [data, items]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!data || openedRef.current) return;
    openedRef.current = true;
    void noteOpened({
      data: {
        nodes: layout.placed.length,
        links: layout.links.length,
        shelf: layout.shelf.length,
      },
    }).catch(() => undefined);
  }, [data, layout.links.length, layout.placed.length, layout.shelf.length, noteOpened]);

  const positions = new Map(layout.placed.map((position) => [position.id, position]));
  const width = Math.max(
    880,
    ...layout.placed.map((position) => position.x + nodeSize(position.kind).width + 80),
  );
  const height = Math.max(
    560,
    ...layout.placed.map((position) => position.y + nodeSize(position.kind).height + 100),
  );

  return (
    <section className="space-y-4">
      <div className="overflow-auto rounded-[6px] border border-[var(--nb-rule)]">
        <div
          className="relative min-h-[560px]"
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
            {layout.links.map((link) => {
              const source = positions.get(link.from_item_id);
              const target = positions.get(link.to_item_id);
              if (!source || !target) return null;
              const curve = curveFor(source, target);
              const offsetCurve = curveFor(source, target, 5);
              const key = `${link.from_item_id}:${link.to_item_id}`;
              return link.status === "draft" ? (
                <g key={key} fill="none" stroke="var(--nb-pencil)" strokeWidth="1.5">
                  <path d={curve.path} strokeDasharray="6 7" />
                  <path d={curve.arrow} />
                </g>
              ) : (
                <g key={key} fill="none" stroke="var(--nb-graphite)">
                  <path d={curve.path} strokeWidth="1.6" />
                  <path d={offsetCurve.path} strokeWidth="0.7" opacity="0.45" />
                  <path d={curve.arrow} strokeWidth="1.6" />
                </g>
              );
            })}
          </svg>
          {layout.placed.map((position) => {
            const item = items.find((candidate) => candidate.id === position.id);
            if (!item) return null;
            return (
              <CanvasNode
                key={position.id}
                item={item}
                position={position}
                summary={data?.summaries.get(position.id)}
                onOpen={onOpen}
              />
            );
          })}
        </div>
      </div>

      <div className="border border-[var(--nb-rule)] p-4">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="font-hand text-[19px]">Not in the picture yet</h2>
          <span className="font-mono text-[9px] text-muted-foreground">{layout.shelf.length}</span>
        </div>
        {layout.shelf.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {layout.shelf.map((item) => (
              <div key={item.id} style={{ width: NODE_W_SOURCE, minHeight: NODE_H_SOURCE }}>
                <WorkNote item={item} onOpen={() => onOpen(item)} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Everything here is in the picture.</p>
        )}
      </div>
    </section>
  );
}