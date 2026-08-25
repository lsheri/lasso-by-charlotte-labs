import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { canTakeBackCard } from "@/components/firm/FirmArchive";
import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork, useUnshipWork } from "@/hooks/use-shipped-work";
import {
  SHOWCASE_CAP,
  SHOWCASE_LINK_LABEL,
  SHOWCASE_TITLE,
} from "@/lib/shipped-work-shared";

/**
 * The latest shipped work on the way in. When nothing has been shipped the row
 * renders nothing at all: no header, no empty state, no invitation.
 */
export function ShippedShowcase() {
  const { data: profile } = useProfile();
  const { data } = useShippedWork();
  const unship = useUnshipWork();

  if (!profile || profile.role === "coach") return null;
  const cards = (data ?? []).slice(0, SHOWCASE_CAP);
  if (cards.length === 0) return null;

  return (
    <section data-testid="shipped-showcase" className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="micro-label micro-label-section">{SHOWCASE_TITLE}</h2>
        <Link
          to="/firm"
          className="text-xs text-accent-deep underline underline-offset-2"
        >
          {SHOWCASE_LINK_LABEL}
        </Link>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {cards.map((card) => (
          <ShippedWorkCard
            key={card.id}
            card={card}
            canTakeBack={canTakeBackCard(profile, card)}
            onTakeBack={(taken) =>
              void unship
                .mutateAsync({ workItemId: taken.work_item_id })
                .then(() => toast("Taken back."))
                .catch((error: unknown) => toast.error((error as Error).message))
            }
          />
        ))}
      </div>
    </section>
  );
}
