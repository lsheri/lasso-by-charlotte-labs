/**
 * LIVE-2 (8 Nov 2026): offline is honest.
 *
 * When the server cannot be reached the board says so, shows when it was last
 * up to date, and pauses editing. It clears itself once the board has caught
 * up. Edits are not saved up for later: merging stale edits afterwards is the
 * exact conflict LIVE-1 removed.
 *
 * LIVE-2b (Liam, 8 Nov): a round floating ink pill with white text, a sketched
 * sad face and a wifi-off mark. Ink, not green: green means Lasso is live, and
 * white on Lasso green fails contrast. Floating things stay round (15).
 */

import { useId } from "react";

export const BOARD_OFFLINE_COPY = {
  offline: (asOf: string) => `You're offline. This is the board as of ${asOf}. Editing is paused until you're back.`,
  offlineNoTime: "You're offline. Editing is paused until you're back.",
} as const;

export function formatBoardAsOf(at: number, locale?: string): string {
  return new Date(at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Hand-drawn sad face, same wobble as the no-preview sketch. */
function SadFace() {
  const id = useId().replace(/:/g, "");
  return (
    <svg data-testid="board-offline-face" viewBox="0 0 24 24" width="20" height="20" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <filter id={`offwob${id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale={1.4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#offwob${id})`}>
        <circle cx="12" cy="12" r="9.5" {...STROKE} />
        <path d="M8 10 q1.2 -1.6 2.4 0" {...STROKE} />
        <path d="M13.6 10 q1.2 -1.6 2.4 0" {...STROKE} />
        <path d="M8.2 16.6 q3.8 -3.4 7.6 0" {...STROKE} />
      </g>
    </svg>
  );
}

/** Wifi arcs with a slash through them. */
function WifiOff() {
  return (
    <svg data-testid="board-offline-wifi" viewBox="0 0 24 24" width="18" height="18" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <path d="M2.5 9 a14 14 0 0 1 19 0" {...STROKE} />
      <path d="M5.8 12.5 a9.5 9.5 0 0 1 12.4 0" {...STROKE} />
      <path d="M9.1 16 a5 5 0 0 1 5.8 0" {...STROKE} />
      <circle cx="12" cy="19.2" r="1.1" fill="currentColor" />
      <path d="M3.5 3.5 L20.5 20.5" {...STROKE} strokeWidth={1.8} />
    </svg>
  );
}

export function BoardOfflineBanner({ offline, syncedAt }: { offline: boolean; syncedAt: number | null }) {
  if (!offline) return null;
  return (
    <div data-testid="board-offline-banner" className="canvas-lab-offline-pill" role="status" aria-live="polite">
      <SadFace />
      <WifiOff />
      <p>{syncedAt ? BOARD_OFFLINE_COPY.offline(formatBoardAsOf(syncedAt)) : BOARD_OFFLINE_COPY.offlineNoTime}</p>
    </div>
  );
}
