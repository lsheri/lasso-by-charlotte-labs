import { useQuery } from "@tanstack/react-query";

import { SectionHeader } from "@/components/notebook/SectionHeader";
import { getFirmLiveBoards } from "@/lib/firm-dashboard.functions";
import { FIRM_LIVE_BOARDS_COPY, type FirmLiveBoard } from "@/lib/firm-live-boards-shared";
import { formatDate } from "@/lib/work-types";

/**
 * Boards colleagues shared with the firm (Liam, 15 Nov), newest share first. Read-only rows: what the board is for,
 * whose it is, and how much placed work it holds. The firm brain builds on this list later.
 */
export function FirmLiveBoards({ profileId }: { profileId: string | undefined }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["firm-live-boards", profileId],
    enabled: Boolean(profileId),
    staleTime: 60_000,
    queryFn: (): Promise<FirmLiveBoard[]> => getFirmLiveBoards({ data: { profile_id: profileId as string } }),
  });

  return (
    <section aria-label={FIRM_LIVE_BOARDS_COPY.title} data-testid="firm-live-boards">
      <SectionHeader title={FIRM_LIVE_BOARDS_COPY.title} />
      <p className="mb-3 text-sm text-muted-foreground">{FIRM_LIVE_BOARDS_COPY.line}</p>
      {error ? <p className="text-sm text-destructive">That could not be loaded. Try again.</p> : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading.</p> : null}
      {data && data.length === 0 ? <p className="text-sm text-muted-foreground">{FIRM_LIVE_BOARDS_COPY.empty}</p> : null}
      {data && data.length > 0 ? (
        <ul className="folder-page-rows">
          {data.map((board) => (
            <li key={board.id} className="flex flex-col gap-1 border-b border-[var(--nb-rule)] px-1 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-(length:--type-lead) font-medium text-foreground">{board.title}</span>
                <span className="font-mono text-(length:--type-label) text-muted-foreground">
                  {[board.client, board.owner, `${board.pieces} ${board.pieces === 1 ? "piece" : "pieces"}`, board.sharedAt ? `shared ${formatDate(board.sharedAt)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {board.brief ? <p className="text-sm text-muted-foreground">{board.brief}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
