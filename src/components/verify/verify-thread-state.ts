import { useSyncExternalStore } from "react";

/**
 * The thread verification reader covers the screen, so its open state lives
 * outside any one surface's tree, exactly like the provenance audit. One
 * request at a time, by design.
 */
export type VerifyThreadRequest = {
  runId: string;
  itemId: string;
  itemTitle: string;
};

let current: VerifyThreadRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openVerifyThread(request: VerifyThreadRequest): void {
  current = request;
  emit();
}

export function closeVerifyThread(): void {
  current = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVerifyThread(): VerifyThreadRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/**
 * Which runs have already told their story in this app session. Memory only:
 * a reload is a new session, and nothing about a person is written down.
 */
const played = new Set<string>();

export function storyPlayed(runId: string): boolean {
  return played.has(runId);
}

export function markStoryPlayed(runId: string): void {
  played.add(runId);
}

/** Test seam only. */
export function resetPlayedStories(): void {
  played.clear();
}

