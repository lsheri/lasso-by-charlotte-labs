import { useEffect, useMemo, useRef } from "react";

import { useProfile } from "@/hooks/use-profile";
import {
  finishFromStart,
  startPerfTimer,
  takeNavStart,
  takeOpenStart,
  type PerfIdentity,
  type PerfName,
  type PerfState,
  type PerfTimer,
} from "@/lib/perf-timing";

/** Who is looking, and under which org the row is written. Nothing else. */
export function usePerfIdentity(): PerfIdentity {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id ?? null;
  const surface: PerfIdentity["surface"] = profile?.role === "coach" ? "coach" : "owner";
  return useMemo(() => ({ orgId, surface }), [orgId, surface]);
}

/** Start a timer at a gesture. Returns a stable factory, never re-created. */
export function usePerfTimerFactory(): (name: PerfName, state?: PerfState) => PerfTimer {
  const identity = usePerfIdentity();
  const ref = useRef(identity);
  ref.current = identity;
  return useMemo(
    () =>
      (name: PerfName, state: PerfState = "cold") =>
        startPerfTimer(name, ref.current, state),
    [],
  );
}

/**
 * Finishes a gesture-anchored open once the surface is usable. Emits at most
 * once per gesture: the start is consumed when it is read.
 */
export function usePerfOpenFinish(name: PerfName, ready: boolean, state: PerfState = "cold"): void {
  const identity = usePerfIdentity();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    finishFromStart(name, takeOpenStart(name), identity, state);
  }, [name, ready, state, identity]);
}

/**
 * Times a surface from its own first render to the frame it becomes usable.
 * Used where the gesture and the mount are the same beat.
 */
export function usePerfMountTimer(name: PerfName, ready: boolean, state: PerfState = "cold"): void {
  const identity = usePerfIdentity();
  const started = useRef<number | null>(null);
  const done = useRef(false);
  if (started.current === null) {
    started.current =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
  }
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    finishFromStart(name, started.current, identity, state);
  }, [name, ready, state, identity]);
}

/**
 * In-app route transitions only. With no recorded navigation start (a hard
 * document load) nothing is emitted, by design.
 */
export function usePerfNavFinish(name: PerfName, ready: boolean, state: PerfState = "cold"): void {
  const identity = usePerfIdentity();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    finishFromStart(name, takeNavStart(), identity, state);
  }, [name, ready, state, identity]);
}
