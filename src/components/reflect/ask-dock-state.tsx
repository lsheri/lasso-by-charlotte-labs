import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type AskTab = "messages" | "history" | "analyses";

export const DOCK_MIN_WIDTH = 320;
/** The hard ceiling when no window is available (SSR, tests). */
export const DOCK_MAX_WIDTH = 1200;
export const DOCK_DEFAULT_WIDTH = 380;
export const STORE_KEY = "lasso.ask.width";

/** The dock may stretch to about seven tenths of the window, never past it. */
export function maxDockWidth(): number {
  const viewport = typeof window === "undefined" ? 0 : window.innerWidth;
  if (!viewport) return DOCK_MAX_WIDTH;
  return Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, Math.round(viewport * 0.7)));
}

export function clampDockWidth(width: number): number {
  if (!Number.isFinite(width)) return DOCK_DEFAULT_WIDTH;
  return Math.min(maxDockWidth(), Math.max(DOCK_MIN_WIDTH, Math.round(width)));
}

type State = {
  width: number;
  setWidth: (width: number) => void;
  tab: AskTab;
  setTab: (tab: AskTab) => void;
};

const AskDockStateContext = createContext<State | null>(null);

function readStored(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return null;
  const width = Number(raw);
  return Number.isFinite(width) ? width : null;
}

/**
 * The dock's shape, held for the session so moving between pages does not
 * reset it. Width persists in localStorage; nothing about a conversation is
 * stored here.
 */
export function AskDockStateProvider({ children }: { children: ReactNode }) {
  const [width, setWidthState] = useState(DOCK_DEFAULT_WIDTH);
  const [tab, setTab] = useState<AskTab>("messages");

  useEffect(() => {
    const stored = readStored();
    if (stored !== null) setWidthState(clampDockWidth(stored));
  }, []);

  const setWidth = useCallback((next: number) => {
    const clamped = clampDockWidth(next);
    setWidthState(clamped);
    try {
      window.localStorage.setItem(STORE_KEY, String(clamped));
    } catch {
      /* a browser that refuses storage still gets a working dock */
    }
  }, []);

  const value = useMemo(() => ({ width, setWidth, tab, setTab }), [width, setWidth, tab]);
  return <AskDockStateContext.Provider value={value}>{children}</AskDockStateContext.Provider>;
}

export function useAskDockState(): State {
  const ctx = useContext(AskDockStateContext);
  const [fallbackWidth, setFallbackWidth] = useState(DOCK_DEFAULT_WIDTH);
  const [fallbackTab, setFallbackTab] = useState<AskTab>("messages");
  const fallback = useMemo(
    () => ({
      width: fallbackWidth,
      setWidth: (next: number) => setFallbackWidth(clampDockWidth(next)),
      tab: fallbackTab,
      setTab: setFallbackTab,
    }),
    [fallbackWidth, fallbackTab],
  );
  return ctx ?? fallback;
}
