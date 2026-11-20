import { Skeleton } from "@/components/ui/skeleton";
import { DESK_COPY } from "@/lib/proposal-desk-shared";

/**
 * 20 Nov 2026 (Liam, D-86): the first load is a quiet frame of the page it will become, never a spinner or a
 * sentence: the view chips, an Up next card, then rows with a title, a lead, a clock and a button. A screen reader
 * hears "Loading proposals". Reduced motion holds it still.
 */
export function ProposalDeskSkeleton({ rows = 3 }: { rows?: number }) {
  const bar = "motion-reduce:animate-none";
  return (
    <div role="status" aria-live="polite" data-proposal-skeleton className="flex flex-col gap-2">
      <span className="sr-only">{DESK_COPY.loading}</span>
      <div aria-hidden="true" className="mb-2 flex gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className={`h-8 w-24 rounded-full ${bar}`} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`grid gap-3 rounded-[var(--radius-card)] border border-border bg-card md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,13rem)_auto] md:items-center md:gap-5 ${index === 0 ? "p-4 sm:p-6" : "px-4 py-3.5"}`}
        >
          <div className="flex flex-col gap-2">
            {index === 0 ? <Skeleton className={`h-3 w-16 ${bar}`} /> : null}
            <Skeleton className={`h-5 w-3/4 ${bar}`} />
            <Skeleton className={`h-3.5 w-1/2 ${bar}`} />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className={`size-7 rounded-full ${bar}`} />
            <Skeleton className={`h-3.5 w-28 ${bar}`} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className={`h-1.5 w-full ${bar}`} />
            <Skeleton className={`h-3.5 w-32 ${bar}`} />
          </div>
          <Skeleton className={`h-8 w-28 ${bar}`} />
        </div>
      ))}
    </div>
  );
}
