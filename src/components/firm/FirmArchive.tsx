import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import { SectionHeader } from "@/components/notebook/SectionHeader";
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
  // Counted here, off the cards this component already holds: deriving them
  // anywhere else would add a query a coach must never run.
  const clientCount = new Set(
    cards.map((card) => card.client_label).filter((label): label is string => Boolean(label)),
  ).size;
  const tracedFacts = cards.reduce((sum, card) => sum + card.traced_facts, 0);

  return (
    <section data-testid="firm-archive">
      <SectionHeader
        title="Shipped work"
        action={
          <Link
            to="/archive"
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep hover:opacity-70"
          >
            Open the archive
          </Link>
        }
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
        {cards.length} shipped · across {clientCount} client{clientCount === 1 ? "" : "s"} ·{" "}
        {tracedFacts} checked at source
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {ARCHIVE_TITLE}: finished work its owner chose to send to the firm. They can take it back
        at any time.
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
