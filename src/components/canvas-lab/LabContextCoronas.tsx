import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

export const CONTEXT_CORONA_MOTION_CAP = 12;
export const CONTEXT_CORONA_EXIT_MS = 200;

/** Stable negative delay, in milliseconds, so neighbouring coronas do not breathe together. */
export function contextCoronaPhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return -(Math.abs(hash) % 13000);
}

/** Reading order decides which twelve context cards keep their living light. */
export function contextCoronaMotionIds(nodes: readonly LabNode[]): string[] {
  return [...nodes]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, CONTEXT_CORONA_MOTION_CAP)
    .map((node) => node.id);
}

type CoronaNode = LabNode & { leaving?: boolean };

export function LabContextCoronas({
  nodes,
  entryDelays,
  motionClass,
}: {
  nodes: readonly LabNode[];
  entryDelays: Readonly<Record<string, number>>;
  motionClass: string;
}) {
  const previousRef = useRef<readonly LabNode[]>(nodes);
  const timersRef = useRef<number[]>([]);
  const [departing, setDeparting] = useState<LabNode[]>([]);
  const currentIds = new Set(nodes.map((node) => node.id));
  const newlyLeaving = previousRef.current.filter((node) => !currentIds.has(node.id));

  useEffect(() => {
    previousRef.current = nodes;
    if (newlyLeaving.length === 0) return;
    setDeparting((current) => {
      const next = new Map(current.map((node) => [node.id, node]));
      newlyLeaving.forEach((node) => next.set(node.id, node));
      return [...next.values()];
    });
    const leavingIds = new Set(newlyLeaving.map((node) => node.id));
    const timer = window.setTimeout(() => {
      setDeparting((current) => current.filter((node) => !leavingIds.has(node.id)));
    }, CONTEXT_CORONA_EXIT_MS);
    timersRef.current.push(timer);
  }, [nodes]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const movingIds = new Set(contextCoronaMotionIds(nodes));
  const rendered = new Map<string, CoronaNode>();
  departing.forEach((node) => rendered.set(node.id, { ...node, leaving: true }));
  newlyLeaving.forEach((node) => rendered.set(node.id, { ...node, leaving: true }));
  nodes.forEach((node) => rendered.set(node.id, node));

  return (
    <div data-testid="lab-context-coronas" className="canvas-lab-context-coronas pointer-events-none absolute inset-0" aria-hidden="true">
      {[...rendered.values()].map((node) => {
        const moving = Boolean(motionClass) && movingIds.has(node.id) && !node.leaving;
        const delay = entryDelays[node.id];
        return (
          <span
            key={node.id}
            data-corona-for={node.id}
            data-moving={moving ? "true" : "false"}
            data-entering={delay !== undefined ? "true" : "false"}
            data-leaving={node.leaving ? "true" : "false"}
            className={`canvas-lab-context-corona ${moving ? motionClass : ""}`}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              "--context-corona-delay": `${delay ?? 0}ms`,
              "--context-corona-phase": `${contextCoronaPhase(node.id)}ms`,
            } as CSSProperties}
          >
            <span className="canvas-lab-corona-falloff" />
            <span className="canvas-lab-corona-band">
              <span className="canvas-lab-corona-flame canvas-lab-corona-flame-a" />
              <span className="canvas-lab-corona-flame canvas-lab-corona-flame-b" />
            </span>
            <span className="canvas-lab-corona-rim" />
          </span>
        );
      })}
    </div>
  );
}