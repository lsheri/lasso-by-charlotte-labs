import { useOptionalQueryClient } from "@/hooks/use-optional-query-client";

import { newCountLabel, useBoardNewCount } from "@/hooks/use-board-new-counts";

/** F3: "3 NEW" with a lime dot; nothing at 0. */
export function NewCountPill({ count }: { count: number }) {
  const label = newCountLabel(count);
  if (!label) return null;
  return (
    <span data-new-count className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[9px] font-bold tracking-[0.08em] text-foreground">
      <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--nb-lasso-green)" }} />
      {label}
    </span>
  );
}

function LiveBoardNewPill({ engagementId }: { engagementId: string }) {
  return <NewCountPill count={useBoardNewCount(engagementId)} />;
}

/** Renders nothing outside a query provider (isolated previews and tests). */
export function BoardNewPill({ engagementId }: { engagementId: string }) {
  const client = useOptionalQueryClient();
  return client ? <LiveBoardNewPill engagementId={engagementId} /> : null;
}
