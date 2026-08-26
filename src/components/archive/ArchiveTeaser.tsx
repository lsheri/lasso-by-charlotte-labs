import { Link } from "@tanstack/react-router";

import { canTakeBackCard } from "@/components/firm/FirmArchive";
import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";
import { ARCHIVE_BROWSE_LINK, ARCHIVE_TEASER_LABEL } from "@/lib/archive-search-shared";

/** Three pieces from the firm, and the way in. Nothing when nothing is shipped. */
export function ArchiveTeaser() {
  const { data: profile } = useProfile();
  const { data } = useShippedWork();

  if (!profile || profile.role === "coach") return null;
  const cards = (data ?? []).slice(0, 3);
  if (cards.length === 0) return null;

  return (
    <section data-testid="archive-teaser" className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {ARCHIVE_TEASER_LABEL}
        </h2>
        <Link
          to="/archive"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
        >
          {ARCHIVE_BROWSE_LINK}
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {cards.map((card) => (
          <ShippedWorkCard key={card.id} card={card} canTakeBack={canTakeBackCard(profile, card)} />
        ))}
      </div>
    </section>
  );
}
