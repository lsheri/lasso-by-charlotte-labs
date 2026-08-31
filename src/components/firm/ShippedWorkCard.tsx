import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { GraphiteRule } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { CardMetaTile } from "@/components/firm/CardMetaTile";
import { deliverableTag } from "@/lib/deliverable-kinds";
import { openJourney } from "@/lib/journey-state";
import {
  TAKE_BACK_CONFIRM_LINE,
  TAKE_BACK_LABEL,
  recordFactsLine,
  type ShippedCard,
} from "@/lib/shipped-work-shared";
import { formatDate } from "@/lib/work-types";

/**
 * The pride object. One card, reused wherever the archive shows up: the mark,
 * the verbatim title, where it belongs, who shipped it, and counts about the
 * work only. Clicking it opens the journey behind it.
 */
export function ShippedWorkCard({
  card,
  canTakeBack,
  onTakeBack,
}: {
  card: ShippedCard;
  canTakeBack: boolean;
  onTakeBack?: ((card: ShippedCard) => void) | undefined;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
  }, []);

  const facts = recordFactsLine(card);
  // The engagement is what the firm recognises; the file name is a detail.
  const headline = card.engagement_title?.trim() || card.title;
  const brief = card.engagement_brief?.trim() ?? "";
  const kindTag = deliverableTag(card.meta, card.type);

  return (
    <div
      data-testid={`shipped-card-${card.work_item_id}`}
      className={`relative w-[260px] shrink-0 rounded-[var(--radius)] border border-border bg-card p-4 text-left ${
        reduceMotion ? "nb-chip-enter-static" : "nb-chip-enter nb-chip-lift"
      }`}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() =>
          openJourney({
            anchorId: card.work_item_id,
            anchorTitle: card.title,
            engagementId: card.engagement_id ?? "",
          })
        }
      >
        <span className="block break-words text-sm font-medium text-foreground">
          {headline}
        </span>
        <GraphiteRule className="mt-1 h-[6px] w-[140px] text-muted-foreground" />
        {brief ? (
          <span
            data-testid={`shipped-card-brief-${card.work_item_id}`}
            className="mt-1 block line-clamp-2 text-xs text-[var(--nb-mid)]"
          >
            {brief}
          </span>
        ) : null}
        <CardMetaTile
          testId={`shipped-card-meta-${card.work_item_id}`}
          kindTestId={`shipped-card-kind-${card.work_item_id}`}
          fileItem={card}
          kindTag={kindTag}
          meta={card.meta}
          type={card.type}
          filename={card.title}
          clientLabel={card.client_label}
          engagementCode={card.engagement_code}
          shipperId={card.shipped_by}
          shipperName={card.shipped_by_name}
          dateLabel={formatDate(card.shipped_at)}
        />
        {facts ? <span className="mt-1 block text-xs text-muted-foreground">{facts}</span> : null}
      </button>

      {canTakeBack ? (
        <>
          <button
            type="button"
            aria-label="More for this card"
            data-testid={`shipped-card-menu-${card.work_item_id}`}
            onClick={() => {
              setConfirming(false);
              setMenu((prev) => !prev);
            }}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
          </button>
          {menu ? (
            <div
              data-testid={`shipped-card-overflow-${card.work_item_id}`}
              className="absolute right-2 top-8 z-20 w-52 rounded-[var(--radius-md)] border border-border bg-card p-1 shadow-md"
            >
              <button
                type="button"
                data-testid={`shipped-card-takeback-${card.work_item_id}`}
                onClick={() => setConfirming(true)}
                className="block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
              >
                {TAKE_BACK_LABEL}
              </button>
              {confirming ? (
                <div
                  data-testid={`shipped-card-confirm-${card.work_item_id}`}
                  className="mt-1 border-t border-border px-2 pb-1 pt-2"
                >
                  <p className="text-xs text-muted-foreground">{TAKE_BACK_CONFIRM_LINE}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setConfirming(false);
                        setMenu(false);
                        onTakeBack?.(card);
                      }}
                    >
                      {TAKE_BACK_LABEL}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(false);
                        setMenu(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
