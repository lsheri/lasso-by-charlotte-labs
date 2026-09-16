/**
 * Best-effort in-memory memo for the shared-sentence lookup. Server memory
 * only: nothing here is ever written to the database, because a quote pulled
 * out of a conversation never gets persisted. A cold cache behaves exactly
 * like no cache at all.
 */

export const SHARED_SENTENCE_CACHE_MAX = 200;
export const SHARED_SENTENCE_CACHE_TTL_MS = 10 * 60 * 1000;

type Entry<V> = { value: V; expires: number };

const store = new Map<string, Entry<unknown>>();

/** Same fnv1a shape used elsewhere in the codebase, hex for readable keys. */
export function hashText(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

export function sharedSentenceKey(deliverableText: string, candidateId: string): string {
  return `${hashText(deliverableText)}:${deliverableText.length}:${candidateId}`;
}

export function clearSharedSentenceCache(): void {
  store.clear();
}

export function sharedSentenceCacheSize(): number {
  return store.size;
}

/** Returns the cached value when fresh, otherwise computes and stores it. */
export async function withSharedSentenceCache<V>(
  key: string,
  compute: () => Promise<V>,
  now: number = Date.now(),
): Promise<V> {
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    // Refresh recency so the LRU eviction keeps what is actually being read.
    store.delete(key);
    store.set(key, hit);
    return hit.value as V;
  }
  if (hit) store.delete(key);

  const value = await compute();
  store.set(key, { value, expires: now + SHARED_SENTENCE_CACHE_TTL_MS });
  while (store.size > SHARED_SENTENCE_CACHE_MAX) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
  return value;
}
