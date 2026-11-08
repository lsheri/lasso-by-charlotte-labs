/**
 * LIVE-2 (8 Nov 2026): offline is honest.
 *
 * When the server cannot be reached the board says so, shows when it was last
 * up to date, and pauses editing. It clears itself once the board has caught
 * up. Edits are not saved up for later: merging stale edits afterwards is the
 * exact conflict LIVE-1 removed.
 */

export const BOARD_OFFLINE_COPY = {
  offline: (asOf: string) => `You're offline. This is the board as of ${asOf}. Editing is paused until you're back.`,
  offlineNoTime: "You're offline. Editing is paused until you're back.",
} as const;

export function formatBoardAsOf(at: number, locale?: string): string {
  return new Date(at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function BoardOfflineBanner({ offline, syncedAt }: { offline: boolean; syncedAt: number | null }) {
  if (!offline) return null;
  return (
    <div data-testid="board-offline-banner" className="canvas-lab-banner" role="status" aria-live="polite">
      <p className="text-[13px] text-foreground">{syncedAt ? BOARD_OFFLINE_COPY.offline(formatBoardAsOf(syncedAt)) : BOARD_OFFLINE_COPY.offlineNoTime}</p>
    </div>
  );
}
