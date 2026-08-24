import { useSyncExternalStore } from "react";

/**
 * The provenance audit view is opened from wherever "What fed this" is
 * confirmed, and it covers the whole screen, so its open state lives outside
 * any one surface's tree. One request at a time, by design.
 */
export type AuditRequest = { anchorId: string; anchorTitle: string };

let current: AuditRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openProvenanceAudit(request: AuditRequest): void {
  current = request;
  emit();
}

export function closeProvenanceAudit(): void {
  current = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProvenanceAudit(): AuditRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
