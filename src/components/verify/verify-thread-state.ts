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
