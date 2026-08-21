import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type AskTab = "messages" | "history" | "analyses" | "analyse";

export const DOCK_MIN_WIDTH = 320;
export const DOCK_MAX_WIDTH = 560;
export const DOCK_DEFAULT_WIDTH = 380;
const STORE_KEY = "lasso.askdock";

export function clampDockWidth(width: number): number {
  if (!Number.isFinite(width)) return DOCK_DEFAULT_WIDTH;
  return Math.min(DOCK_MAX_WIDTH, Math.max(DOCK_MIN_WIDTH, Math.round(width)));
}

type State = {
  width: number;
  setWidth: (width: number) => void;
  tab: AskTab;
  setTab: (tab: AskTab) => void;
};

const AskDockStateContext = createContext<State | null>(null);

function readStored(): { width?: number } {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as { width?: number };
  } catch {
    return {};
  }
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
    if (typeof stored.width === "number") setWidthState(clampDockWidth(stored.width));
  }, []);

  const setWidth = useCallback((next: number) => {
    const clamped = clampDockWidth(next);
    setWidthState(clamped);
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ width: clamped }));
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
