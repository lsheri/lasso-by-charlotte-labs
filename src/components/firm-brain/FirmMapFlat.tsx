import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { FIRM_MAP_COPY, project, type MapNode, type Projected } from "@/lib/firm-map-shared";
import { cn } from "@/lib/utils";

import { SEW_MS, type FirmMapRendererProps } from "./firm-map-renderer";

/** One fixed view: the flat map never turns, so nothing spins for anyone. */
const YAW = 0.55;
const PITCH = 0.28;
const VIEW = { x: -380, y: -330, w: 760, h: 660 };
/** Deck names show only when this few threads are pulled, so the stage never fills with words. */
const FEW = 9;

function pathOf(points: Projected[]): string {
  if (points.length < 3) return "";
  let d = `M${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i + 1 < points.length; i += 2)
    d += ` Q${points[i]!.x} ${points[i]!.y} ${points[i + 1]!.x} ${points[i + 1]!.y}`;
  return d;
}

/**
 * The flat firm map: the same layout as the 3D map seen from one angle, as SVG. Every point is a button a keyboard
 * can reach, with a plain label. The 3D map falls back to this when it cannot start. Lime is only ever a stitch,
 * never text or focus; points and words are navy.
 */
export function FirmMapFlat({
  layout,
  lit,
  litNodes,
  selected,
  reduceMotion,
  replayKey,
  replayDelays,
  onHover,
  onPick,
}: FirmMapRendererProps) {
  const [sewing, setSewing] = useState(false);
  const paths = useRef(new Map<string, SVGPathElement>());

  const nodes = useMemo(
    () =>
      layout.nodes
        .map((node) => ({ node, at: project(node.position, YAW, PITCH) }))
        // Far points first, so near ones sit on top.
        .sort((a, b) => a.at.depth - b.at.depth || a.node.id.localeCompare(b.node.id)),
    [layout],
  );
  const threads = useMemo(
    () =>
      layout.threads
        .map((thread) => ({
          thread,
          d: pathOf(thread.path.map((point) => project(point, YAW, PITCH))),
        }))
        .filter((entry) => entry.d),
    [layout],
  );

  useEffect(() => {
    if (!replayKey || reduceMotion) return;
    setSewing(true);
    const longest = Math.max(0, ...replayDelays.values()) + SEW_MS;
    const done = window.setTimeout(() => setSewing(false), longest);
    return () => window.clearTimeout(done);
  }, [replayKey, reduceMotion, replayDelays]);

  useEffect(() => {
    if (!sewing || reduceMotion) return;
    const running: Animation[] = [];
    for (const [id, element] of paths.current) {
      if (typeof element.animate !== "function") continue;
      running.push(
        element.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: SEW_MS,
          delay: replayDelays.get(id) ?? 0,
          easing: "ease-out",
          fill: "both",
        }),
      );
    }
    return () => running.forEach((animation) => animation.cancel());
  }, [sewing, reduceMotion, replayDelays]);

  const few = lit !== null && lit.size > 0 && lit.size <= FEW;

  function keyed(event: KeyboardEvent, node: MapNode) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(node.id);
    }
  }

  return (
    <svg
      data-testid="firm-map-flat"
      role="group"
      aria-label={FIRM_MAP_COPY.mapLabel}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      className="block h-full w-full select-none"
    >
      <rect
        x={VIEW.x}
        y={VIEW.y}
        width={VIEW.w}
        height={VIEW.h}
        className="fill-transparent"
        onClick={() => onPick(null)}
      />
      <g aria-hidden="true">
        {threads.map(({ thread, d }) => {
          const on = lit?.has(thread.id) ?? false;
          return (
            <path
              key={thread.id}
              ref={(element) => {
                if (element) paths.current.set(thread.id, element);
                else paths.current.delete(thread.id);
              }}
              d={d}
              data-thread={thread.id}
              data-lit={on ? "true" : undefined}
              pathLength={sewing ? 1 : undefined}
              strokeDasharray={sewing ? "1 1" : on ? undefined : "7 4"}
              strokeLinecap="round"
              className={cn(
                "fill-none stroke-(--live) transition-opacity duration-300 motion-reduce:transition-none",
                on ? "[stroke-width:3.5]" : "[stroke-width:2.6]",
                lit && !on ? "opacity-10" : "opacity-100",
              )}
            />
          );
        })}
      </g>
      {nodes.map(({ node, at }) => {
        const on = !litNodes || litNodes.has(node.id);
        const showLabel =
          node.kind === "situation" ||
          node.kind === "method" ||
          (node.kind === "deck" && few && on);
        const r = node.size * at.scale;
        return (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-label={`${FIRM_MAP_COPY.kind[node.kind]}: ${node.label}`}
            aria-pressed={selected === node.id}
            data-node={node.id}
            data-node-kind={node.kind}
            data-faded={on ? undefined : "true"}
            className={cn(
              "cursor-pointer outline-none transition-opacity duration-300 motion-reduce:transition-none",
              on ? "opacity-100" : "opacity-10",
            )}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") onHover(node.id);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") onHover(null);
            }}
            onFocus={() => onHover(node.id)}
            onBlur={() => onHover(null)}
            onClick={() => onPick(node.id)}
            onKeyDown={(event) => keyed(event, node)}
          >
            <circle cx={at.x} cy={at.y} r={Math.max(r * 2.4, 9)} className="fill-transparent" />
            <circle
              cx={at.x}
              cy={at.y}
              r={r}
              className={cn(
                node.kind === "method"
                  ? "fill-[var(--t-talk,var(--text-secondary))]"
                  : "fill-(--text-primary)",
                selected === node.id
                  ? "stroke-(--text-primary) [stroke-width:2] [stroke-opacity:0.35]"
                  : null,
              )}
            />
            {showLabel ? (
              <text
                x={at.x}
                y={at.y - r - 6}
                textAnchor="middle"
                className={cn(
                  "pointer-events-none [paint-order:stroke] stroke-(--surface-raised) [stroke-width:4] [stroke-linejoin:round]",
                  node.kind === "situation" &&
                    "fill-(--text-primary) text-(length:--type-small) font-semibold",
                  node.kind === "method" &&
                    "fill-[var(--t-talk,var(--text-secondary))] font-mono text-(length:--type-label) uppercase tracking-wider",
                  node.kind === "deck" &&
                    "fill-(--text-primary) text-(length:--type-small) font-medium",
                )}
              >
                {node.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
