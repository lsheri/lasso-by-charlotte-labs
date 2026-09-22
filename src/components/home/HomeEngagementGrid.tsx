import { Link } from "@tanstack/react-router";

import { emitClientEvent } from "@/lib/client-telemetry";
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
}: {
  cards: readonly HomeGridEngagement[];
  availableWidth: number;
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
            <Link
              to="/engagements/$id/canvas-lab"
              params={{ id: card.id }}
              search={{ from: "home" }}
              onClick={() => emitClientEvent("home.engagement_opened", {})}
              className="block h-full rounded-[var(--radius-control)] border border-border bg-card p-3 transition-colors hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div
                aria-hidden
                className="h-[132px] rounded-[var(--radius-control)] border border-dashed border-border bg-[var(--nb-paper,transparent)]"
              />
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
          </li>
        ))}
      </ul>
    </section>
  );
}
