import { useSyncExternalStore } from "react";

/**
 * The thread reader covers the screen, so its open state lives outside any one
 * surface's tree, exactly like the provenance audit. One request at a time, by
 * design. Pass 130: the same store, and the same shell, carry a second kind.
 */
export type VerifyThreadKind = "verification" | "decisions";

export type VerifyThreadRequest = {
  /**
   * PASS 131: null means the run is still going. The reader opens anyway and
   * plays a working read-through over the transcript until this lands.
   */
  runId: string | null;
  itemId: string;
  itemTitle: string;
  /** Defaults to "verification", so every pass 128 caller is unchanged. */
  kind?: VerifyThreadKind;
  /** Set when the run failed. The reader says so and offers a way out. */
  error?: string | null;
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

/** Open the reader before the run exists. One request at a time, as always. */
export function openVerifyThreadPending(request: {
  itemId: string;
  itemTitle: string;
  kind?: VerifyThreadKind;
}): void {
  current = { ...request, runId: null, error: null };
  emit();
}

/** The run landed: the same reader, now with findings to settle. */
export function resolveVerifyThread(runId: string): void {
  if (!current || current.runId !== null) return;
  current = { ...current, runId, error: null };
  emit();
}

/** The run failed: the reader stays open and says what happened. */
export function failVerifyThread(message: string): void {
  if (!current || current.runId !== null) return;
  current = { ...current, error: message };
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

