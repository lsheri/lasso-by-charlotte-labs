import { ArchivePile } from "@/components/archive/ArchivePile";
import type { ShippedCard } from "@/lib/shipped-work-shared";
import { formatDate } from "@/lib/work-types";

export type ArchiveSpineGroup = {
  key: string;
  cards: ShippedCard[];
};

export function ArchiveSpine({
  groups,
  hidden = false,
}: {
  groups: ArchiveSpineGroup[];
  hidden?: boolean;
}) {
  return (
    <div className="relative pl-7">
      <div
        aria-hidden
        className="absolute bottom-4 left-[5px] top-2 w-px bg-[var(--nb-pencil)]"
      />
      <div className="flex flex-col gap-9">
        {groups.map((group) => {
          const newest = group.cards[0];
          if (!newest) return null;
          const engagement = [newest.engagement_code, newest.engagement_title]
            .filter(Boolean)
            .join(" ");

          return (
            <section key={group.key} className="relative">
              <span
                aria-hidden
                className="absolute -left-7 top-2 h-[11px] w-[11px] rounded-full bg-graphite"
              />
              {/* Figma 29:833 sets the engagement's name in plain body text,
                  not in the handwritten `section-title` used for live sections.
                  Past work is filed, and filed things are labelled, not
                  annotated. */}
              <header className="mb-3">
                <h2 className="text-[15px] leading-[21px] text-foreground">
                  {engagement || "Other work"}
                </h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Closed {formatDate(newest.shipped_at)} · {group.cards.length}{" "}
                  {group.cards.length === 1 ? "piece" : "pieces"} of work
                </p>
              </header>
              <ArchivePile cards={group.cards} hidden={hidden} layout="grid" />
            </section>
          );
        })}
      </div>
    </div>
  );
}