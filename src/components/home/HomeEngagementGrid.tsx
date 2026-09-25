import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { emitClientEvent } from "@/lib/client-telemetry";
import { regionFillStyle } from "@/lib/board-region";
import {
  HOME_PREVIEW_HEIGHT,
  previewTransform,
  type HomePreviewState,
  type PreviewRect,
} from "@/lib/home-board-preview";
import { lastOpenedLabel, orderHomeGrid, type HomeGridEngagement } from "@/lib/home-grid";

export const HOME_GRID_GAP = 24;
export const HOME_GRID_CARD_HEIGHT = 228;
const HOME_GRID_MIN_CARD_WIDTH = 220;

export function homeGridColumnCount(availableWidth: number): number {
  return Math.max(1, Math.min(4, Math.floor((availableWidth + HOME_GRID_GAP) / (HOME_GRID_MIN_CARD_WIDTH + HOME_GRID_GAP))));
}

export function homeGridHeight(cardCount: number, availableWidth: number): number {
  if (cardCount === 0) return 0;
  const rows = Math.ceil(cardCount / homeGridColumnCount(availableWidth));
  return rows * HOME_GRID_CARD_HEIGHT + (rows - 1) * HOME_GRID_GAP;
}

function projectedRect(rect: PreviewRect, transform: ReturnType<typeof previewTransform>) {
  return {
    x: rect.x * transform.scale + transform.offsetX,
    y: rect.y * transform.scale + transform.offsetY,
    width: Math.max(0, rect.w * transform.scale),
    height: Math.max(0, rect.h * transform.scale),
  };
}

export function HomeBoardPreview({ state }: { state: HomePreviewState }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(220);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setWidth(container.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const board = state.status === "ready" ? state.board : null;
  const rects = board ? [...board.frames, ...board.nodes] : [];
  const transform = previewTransform(rects, { width, height: HOME_PREVIEW_HEIGHT });

  return (
    <div
      ref={containerRef}
      data-testid="home-board-preview"
      data-preview-state={state.status === "loading" ? "loading" : rects.length === 0 ? "empty" : "populated"}
      className="h-[132px] overflow-hidden rounded-[var(--radius-control)] border border-dashed border-border bg-[var(--nb-paper,transparent)]"
      aria-hidden
    >
      {board && rects.length > 0 ? (
        <svg className="block h-full w-full" viewBox={`0 0 ${width} ${HOME_PREVIEW_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          {board.frames.map((frame, index) => {
            const projected = projectedRect(frame, transform);
            const colours = regionFillStyle(frame.fill);
            return (
              <rect
                key={`frame-${index}`}
                data-preview-frame="true"
                {...projected}
                rx="4"
                fill={colours.fill}
                stroke={colours.edge}
                strokeWidth="1"
                strokeDasharray="3 2"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {board.nodes.map((node, index) => (
            <rect
              key={`node-${index}`}
              data-preview-node="true"
              {...projectedRect(node, transform)}
              rx="2"
              className="fill-card stroke-border"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

/**
 * P4b: the Home grid.
 *
 * The preview area is paper only. A card stands on the client, the title, when
 * you last opened it and how much work is in it, all of which are read from
 * the record.
 */
export function HomeEngagementGrid({
  cards,
  availableWidth,
  previews,
  demo = false,
  onDemoOpen,
}: {
  cards: readonly HomeGridEngagement[];
  availableWidth: number;
  previews?: ReadonlyMap<string, HomePreviewState>;
  /** Public demo: cards open the read-only demo board and carry no "last opened" line. */
  demo?: boolean;
  onDemoOpen?: (code: string) => void;
}) {
  if (cards.length === 0) return null;
  const ordered = orderHomeGrid(cards);
  const columns = homeGridColumnCount(availableWidth);

  return (
    <section aria-label="Your engagements" className="h-full w-full text-left">
      <ul
        data-testid="home-engagement-grid"
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {ordered.map((card) => (
          <li key={card.id} className="h-[228px] min-w-0">
            {demo ? (
              <Link
                to="/demo/$code"
                params={{ code: card.code }}
                data-testid={`demo-engagement-${card.code}`}
                onClick={() => onDemoOpen?.(card.code)}
                className="block h-full rounded-[var(--radius-control)] border border-border bg-card p-3 transition-colors hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
              >
              <HomeBoardPreview state={previews?.get(card.id) ?? { status: "loading" }} />
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {card.clientLabel ?? card.code}
              </p>
              <p className="mt-1 truncate text-[14px] leading-[1.4] text-foreground">{card.title}</p>
              <p className="mt-1 text-xs leading-[1.5] text-muted-foreground">
                {demo ? null : <span data-testid={`home-card-when-${card.id}`}>{lastOpenedLabel(card.lastViewedAt)}</span>}
                {card.workCount === null ? null : (
                  <span>
                    {demo ? "" : " · "}
                    {card.workCount} {card.workCount === 1 ? "piece of work" : "pieces of work"}
                  </span>
                )}
              </p>
              </Link>
            ) : (
            <Link
              to="/engagements/$id/canvas-lab"
              params={{ id: card.id }}
              search={{ from: "home" }}
              onClick={() => emitClientEvent("home.engagement_opened", {})}
              className="block h-full rounded-[var(--radius-control)] border border-border bg-card p-3 transition-colors hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <HomeBoardPreview state={previews?.get(card.id) ?? { status: "loading" }} />
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {card.clientLabel ?? card.code}
              </p>
              <p className="mt-1 truncate text-[14px] leading-[1.4] text-foreground">{card.title}</p>
              <p className="mt-1 text-xs leading-[1.5] text-muted-foreground">
                <span data-testid={`home-card-when-${card.id}`}>{lastOpenedLabel(card.lastViewedAt)}</span>
                {card.workCount === null ? null : (
                  <span>
                    {" · "}
                    {card.workCount} {card.workCount === 1 ? "piece of work" : "pieces of work"}
                  </span>
                )}
              </p>
            </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
