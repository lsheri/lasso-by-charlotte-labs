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
  layout = "pile",
}: {
  cards: ShippedCard[];
  hidden?: boolean;
  /**
   * Figma 29:833 lays the archive out neatly, two cards abreast under each
   * closed engagement, rather than as loose paper. Past work is the one place
   * in the app that is finished and filed, so it is the one place the scatter
   * says the wrong thing.
   *
   * Defaults to "pile", so every existing caller is unchanged.
   */
  layout?: "pile" | "grid";
}) {
  const { data: profile } = useProfile();
  const unship = useUnshipWork();
  if (!profile || profile.role === "coach") return null;

  const neat = layout === "grid";

  return (
    <div
      className={
        neat
          ? `grid gap-3 sm:grid-cols-2 ${hidden ? "hidden" : ""}`
          : `nb-pile ${hidden ? "nb-pile-hidden" : "nb-pile-shown"}`
      }
      data-testid="archive-pile"
      aria-hidden={hidden || undefined}
    >
      {cards.map((card) => {
        const { dx, dy, rot } = scatterFor(card.id);
        return (
          <div
            key={card.id}
            className={neat ? undefined : "nb-pile-item"}
            data-testid={`archive-pile-item-${card.work_item_id}`}
            style={
              neat
                ? undefined
                : ({
                    "--nb-dx": `${dx}px`,
                    "--nb-dy": `${dy}px`,
                    "--nb-rot": `${rot}deg`,
                  } as React.CSSProperties)
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
