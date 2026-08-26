import { toast } from "sonner";

import { canTakeBackCard } from "@/components/firm/FirmArchive";
import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import { scatterFor } from "@/components/work/pile-scatter";
import { useProfile } from "@/hooks/use-profile";
import { useUnshipWork } from "@/hooks/use-shipped-work";
import type { ShippedCard } from "@/lib/shipped-work-shared";

/**
 * The archive pile. Rotation is seeded by the card's id, never by its index and
 * never re-seeded on render, so the scatter is byte identical every time the
 * pile comes back from a search.
 */
export function ArchivePile({
  cards,
  hidden = false,
}: {
  cards: ShippedCard[];
  hidden?: boolean;
}) {
  const { data: profile } = useProfile();
  const unship = useUnshipWork();
  if (!profile || profile.role === "coach") return null;

  return (
    <div
      className={`nb-pile ${hidden ? "nb-pile-hidden" : "nb-pile-shown"}`}
      data-testid="archive-pile"
      aria-hidden={hidden || undefined}
    >
      {cards.map((card) => {
        const { dx, dy, rot } = scatterFor(card.id);
        return (
          <div
            key={card.id}
            className="nb-pile-item"
            data-testid={`archive-pile-item-${card.work_item_id}`}
            style={
              {
                "--nb-dx": `${dx}px`,
                "--nb-dy": `${dy}px`,
                "--nb-rot": `${rot}deg`,
              } as React.CSSProperties
            }
          >
            <ShippedWorkCard
              card={card}
              canTakeBack={canTakeBackCard(profile, card)}
              onTakeBack={(taken) =>
                void unship
                  .mutateAsync({ workItemId: taken.work_item_id })
                  .then(() => toast("Taken back."))
                  .catch((error: unknown) => toast.error((error as Error).message))
              }
            />
          </div>
        );
      })}
    </div>
  );
}
