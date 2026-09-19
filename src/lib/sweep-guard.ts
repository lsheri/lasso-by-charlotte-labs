/**
 * Pass 173: the timing rules for background sweeps, kept pure so they can be
 * reasoned about and tested without a runtime. Two rules only: at most one run
 * per window, and never two runs at the same time in one instance.
 */

/** Several minutes between opportunistic runs. */
export const SWEEP_MIN_INTERVAL_MS = 5 * 60 * 1000;

/** A lock this old is assumed to belong to a run that was cut off before its release. */
export const SWEEP_STALE_MS = 10 * 60 * 1000;

export type SweepState = {
  lastStartedAt: number | null;
  running: boolean;
};

export function createSweepState(): SweepState {
  return { lastStartedAt: null, running: false };
}

export type SweepDecision = "run" | "too-soon" | "already-running";

/** Pure: what a call at this moment is allowed to do. */
export function decideSweep(
  state: SweepState,
  now: number,
  minIntervalMs: number = SWEEP_MIN_INTERVAL_MS,
): SweepDecision {
  if (state.running) {
    const stale =
      state.lastStartedAt !== null && now - state.lastStartedAt >= SWEEP_STALE_MS;
    if (!stale) return "already-running";
    // Fall through: the old run is presumed lost; this call may take over.
  }
  if (state.lastStartedAt !== null && now - state.lastStartedAt < minIntervalMs) return "too-soon";
  return "run";
}

/**
 * Claims the slot when allowed, mutating the state. Returns true when the
 * caller owns the run and must call releaseSweep when it finishes.
 */
export function tryStartSweep(
  state: SweepState,
  now: number,
  minIntervalMs: number = SWEEP_MIN_INTERVAL_MS,
): boolean {
  if (decideSweep(state, now, minIntervalMs) !== "run") return false;
  state.lastStartedAt = now;
  state.running = true;
  return true;
}

export function releaseSweep(state: SweepState): void {
  state.running = false;
}
