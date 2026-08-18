import { useSyncExternalStore } from "react";

/**
 * A checklist step deep links to a real surface and asks for exactly one
 * anchored note there. This is deliberately not a tour engine: one pending
 * guide at a time, cleared by any click.
 */
export type GuideId =
  | "connect"
  | "capture"
  | "map"
  | "analyze"
  | "invite-coach"
  | "naming"
  | "invite-team"
  | "shared-engagement"
  | "coach-analysis"
  | "firm-check"
  | "one-on-one";

let pending: GuideId | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function requestGuide(id: GuideId): void {
  pending = id;
  emit();
}

export function clearGuide(): void {
  if (pending === null) return;
  pending = null;
  emit();
}

export function usePendingGuide(): GuideId | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
    () => null,
  );
}
