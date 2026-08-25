import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import { scatterFor } from "@/components/work/pile-scatter";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork, useUnshipWork } from "@/hooks/use-shipped-work";
import { ARCHIVE_TITLE, type ShippedCard } from "@/lib/shipped-work-shared";

/** The shipper or the owner can take a card back, nobody else. */
export function canTakeBackCard(
  profile: { id: string; role: string } | null | undefined,
  card: ShippedCard,
): boolean {
  if (!profile || profile.role === "coach") return false;
  return card.shipped_by === profile.id || card.owner_id === profile.id;
}

/** The archive, in the app's loose paper language: newest work first. */
export function FirmArchive() {
  const { data: profile } = useProfile();
  const { data, isLoading } = useShippedWork();
  const unship = useUnshipWork();
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    setReduceMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
  }, []);

  if (!profile || profile.role === "coach") return null;

  const cards = data ?? [];

  return (
    <section
      data-testid="firm-archive"
      className="rounded-[var(--radius)] border border-border bg-card p-5"
    >
      <h2 className="micro-label micro-label-section">{ARCHIVE_TITLE}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Finished work its owner chose to send to the firm. They can take it back at any time.
      </p>
      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Reading the archive.</p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been shipped yet.</p>
        ) : (
          <div
            className="nb-pile"
            data-scatter={reduceMotion ? "0" : "1"}
            data-testid="firm-archive-pile"
          >
            {cards.map((card) => {
              const { dx, dy, rot } = scatterFor(card.id);
              return (
                <div
                  key={card.id}
                  className="nb-pile-item"
                  data-testid={`firm-pile-item-${card.work_item_id}`}
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
        )}
      </div>
    </section>
  );
}
