import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { BrandLogo, brandForToolkit } from "@/components/connectors/BrandLogo";
import { useVendorVisible } from "@/hooks/use-vendor-display";
import { getTrail } from "@/lib/trail.functions";
import type { Trail, TrailEntry } from "@/lib/trail-shared";

export const TRAIL_COPY = {
  tab: "Trail",
  madeFrom: "Made from",
  usedIn: "Used in",
  nothingMade: "Nothing linked yet",
  nothingUsed: "Not used in anything yet",
  born: "Lasso saw this happen",
  confirmed: "Confirmed link",
  drawn: "Linked on the board",
  offBoard: "Not on this board",
  loading: "Reading the trail",
  failed: "The trail could not be read. Close and open the work to try again.",
  rule: "Only links Lasso saw happen or a person confirmed.",
} as const;

/** How a link got onto the trail, in words. Never who made it. */
export function trailHowLine(entry: TrailEntry): string {
  if (entry.how === "born") return TRAIL_COPY.born;
  if (entry.how === "confirmed") return entry.note?.trim() || TRAIL_COPY.confirmed;
  return entry.relation && entry.relation !== "context" ? `${TRAIL_COPY.drawn} · ${entry.relation}` : TRAIL_COPY.drawn;
}

/**
 * T2b (one view): the Trail tab. Two directions, Made from and Used in, and the kind of work decides which
 * comes first. Every line is a link Lasso saw happen or a person confirmed (getTrail, #94): never the
 * rest of the engagement, never a draft, never a count. A piece on this board opens in the same view; one
 * that is not stays as a line.
 */
export function LiftedTrail({
  workItemId,
  workboardId,
  profileId,
  canOpen,
  onOpenItem,
}: {
  workItemId: string;
  workboardId: string | null;
  profileId: string | null;
  canOpen: (workItemId: string) => boolean;
  onOpenItem: (workItemId: string) => void;
}) {
  const load = useServerFn(getTrail);
  const vendorVisible = useVendorVisible();
  const { data, isLoading, isError } = useQuery<Trail>({
    queryKey: ["trail", workItemId, workboardId, profileId],
    enabled: Boolean(profileId),
    staleTime: 30_000,
    queryFn: () =>
      load({ data: { work_item_id: workItemId, workboard_id: workboardId ?? undefined, profile_id: profileId ?? undefined } }),
  });

  if (isError) return <p className="lift-trail-note" data-testid="trail-failed">{TRAIL_COPY.failed}</p>;
  if (isLoading || !data) return <p className="lift-trail-note" data-testid="trail-loading">{TRAIL_COPY.loading}</p>;

  const section = (title: string, entries: TrailEntry[], empty: string, testId: string) => (
    <section className="lift-trail-section" data-testid={testId}>
      <h3 className="lift-trail-heading">{title}</h3>
      {entries.length === 0 ? (
        <p className="lift-trail-empty">{empty}</p>
      ) : (
        <ul className="lift-trail-list">
          {entries.map((entry) => {
            const openable = canOpen(entry.item.id);
            const brand = vendorVisible && entry.item.source_vendor ? brandForToolkit(entry.item.source_vendor) : null;
            const body = (
              <>
                <span className="lift-trail-mark" aria-hidden="true">
                  {brand && brand !== "unknown" ? <BrandLogo brand={brand} size={14} /> : <span className="lift-trail-dot" />}
                </span>
                <span className="lift-trail-text">
                  <span className="lift-trail-title">{entry.item.title}</span>
                  <span className="lift-trail-how">{openable ? trailHowLine(entry) : `${trailHowLine(entry)} · ${TRAIL_COPY.offBoard}`}</span>
                </span>
              </>
            );
            return (
              <li key={entry.item.id} data-how={entry.how}>
                {openable ? (
                  <button type="button" className="lift-trail-item" onClick={() => onOpenItem(entry.item.id)}>
                    {body}
                  </button>
                ) : (
                  <span className="lift-trail-item" data-off-board="true">
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const made = section(TRAIL_COPY.madeFrom, data.madeFrom, TRAIL_COPY.nothingMade, "trail-made-from");
  const used = section(TRAIL_COPY.usedIn, data.usedIn, TRAIL_COPY.nothingUsed, "trail-used-in");
  return (
    <div className="lift-trail" data-testid="lift-trail" data-leads={data.leadsWith}>
      {data.leadsWith === "made" ? (
        <>
          {made}
          {used}
        </>
      ) : (
        <>
          {used}
          {made}
        </>
      )}
      <p className="lift-trail-rule">{TRAIL_COPY.rule}</p>
    </div>
  );
}
