import { Link } from "@tanstack/react-router";

import { emitClientEvent } from "@/lib/client-telemetry";
import { lastOpenedLabel, orderHomeGrid, type HomeGridEngagement } from "@/lib/home-grid";

/**
 * P4b: the Home grid.
 *
 * The preview area is paper only. A card stands on the client, the title, when
 * you last opened it and how much work is in it, all of which are read from
 * the record.
 */
export function HomeEngagementGrid({ cards }: { cards: readonly HomeGridEngagement[] }) {
  if (cards.length === 0) return null;
  const ordered = orderHomeGrid(cards);

  return (
    <section aria-label="Your engagements" className="mt-10 text-left">
      <ul data-testid="home-engagement-grid" className="grid grid-cols-2 gap-4">
        {ordered.map((card) => (
          <li key={card.id}>
            <Link
              to="/engagements/$id/canvas-lab"
              params={{ id: card.id }}
              search={{ from: "home" }}
              onClick={() => emitClientEvent("home.engagement_opened", {})}
              className="block rounded-[var(--radius-control)] border border-border bg-card p-3 transition-colors hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div
                aria-hidden
                className="h-[96px] rounded-[var(--radius-control)] border border-dashed border-border bg-[var(--nb-paper,transparent)]"
              />
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {card.clientLabel ?? card.code}
              </p>
              <p className="mt-1 truncate text-[14px] leading-[1.4] text-foreground">{card.title}</p>
              <p className="mt-1 text-[11.5px] leading-[1.5] text-muted-foreground">
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
