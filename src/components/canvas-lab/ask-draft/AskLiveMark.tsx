import { useEffect, useMemo, useState } from "react";

import { anchoredDelayMs, askMarkState, READING_CYCLE_MS } from "@/lib/ask-reading-clock";

/** V2-3 keyframes live with the component, never in the global stylesheet. */
export const ASK_LIVE_MARK_STYLES = `
@keyframes ask-l2-light { from { stroke-dashoffset: 0.14; } to { stroke-dashoffset: -1; } }
.ask-l2-mark { color: var(--ask-mark); }
.ask-l2-mark[data-state="ink"] { color: var(--nb-ink); }
.ask-l2-mark .ask-l2-light { stroke: var(--ask-live); stroke-dasharray: 0.14 1; stroke-dashoffset: 0.14; animation: ask-l2-light ${READING_CYCLE_MS}ms linear infinite; }
@media (prefers-reduced-motion: reduce) { .ask-l2-mark .ask-l2-light { display: none; } }
`;

/** One path that runs the whole mark: around the loop, through it, then down the rope to its tip. */
export const ROPE_PATH = "M20 6c7.7 0 14 6.3 14 14s-6.3 14-14 14S6 27.7 6 20 12.3 6 20 6c5.5 0 9 4.5 9 14l7 7";

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/**
 * V2-3 L2, light down the rope: the whole mark stays still and a lime light
 * travels it while Lasso works. A failed or offline send turns the mark ink and
 * there is no light. The light is anchored to the turn's start, so a redraw
 * resumes it where it was.
 */
export function AskLiveMark({ pending, error, turnKey }: { pending: boolean; error: boolean; turnKey: string }) {
  const online = useOnline();
  const state = askMarkState({ pending, error, online });
  // Worked out once per mount and turn: a delay that changed on every render would make the light jump.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const delay = useMemo(() => (state === "live" ? anchoredDelayMs(turnKey, performance.now()) : 0), [turnKey, state]);
  return (
    <span className="ask-l2-mark inline-flex" data-state={state} data-testid="ask-live-mark" aria-hidden="true">
      <style>{ASK_LIVE_MARK_STYLES}</style>
      <svg className="h-[24px] w-[24px]" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14S27.7 6 20 6z" />
        <path d="M20 6c5.5 0 9 4.5 9 14s-3.5 14-9 14" />
        <path d="M29 20l7 7" />
        {state === "live" ? (
          <path className="ask-l2-light" d={ROPE_PATH} pathLength={1} style={{ animationDelay: `${delay}ms` }} data-testid="ask-live-light" />
        ) : null}
      </svg>
    </span>
  );
}
