import { useSyncExternalStore } from "react";

/**
 * The journey covers the whole screen and is opened from wherever a deliverable
 * is read, so its open state lives outside any one surface's tree. One at a
 * time, by design.
 */
export type JourneyRequest = {
  anchorId: string;
  anchorTitle: string;
  engagementId: string;
};

let current: JourneyRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openJourney(request: JourneyRequest): void {
  current = request;
  emit();
}

export function closeJourney(): void {
  current = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useJourneyRequest(): JourneyRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
