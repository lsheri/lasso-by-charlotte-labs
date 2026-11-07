import { supabase } from "@/integrations/supabase/client";
import type { ContextScope } from "@/lib/reflect-shared";

/** A primed read set stays warm about five minutes at the provider; re-prime a little before that. */
const PRIME_TTL_MS = 4 * 60 * 1000;
const primed = new Map<string, number>();
/** TOTAL-5b: the prime currently on its way for each read set, so Send can wait for it. */
const inFlight = new Map<string, Promise<void>>();

export function primeKey(scope: ContextScope): string {
  return `${scope.mode}:${[...scope.ids].sort().join(",")}:${scope.board ?? ""}`;
}

/**
 * TOTAL-5: warm the model cache for the read set the person is about to ask
 * about. Fire and forget, once per read set per TTL, never on the whole
 * record. Failures are silent: the question still works, only slower.
 */
export async function primeReadSet(scope: ContextScope, profileId?: string): Promise<void> {
  if (scope.mode === "whole" || scope.ids.length === 0) return;
  const key = primeKey(scope);
  const last = primed.get(key) ?? 0;
  if (Date.now() - last < PRIME_TTL_MS) return;
  primed.set(key, Date.now());
  const run = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/reflect/prime", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scope, profile_id: profileId }),
        keepalive: true,
      });
      if (!response.ok) primed.delete(key);
    } catch {
      primed.delete(key);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, run);
  await run;
}

/**
 * TOTAL-5b: a question sent while its read set is still being primed waits
 * for the prime (up to maxMs) instead of racing it. A race makes both calls
 * pay the full read; waiting costs no extra time because the prime started
 * first, and the question then reads the record from the cache.
 */
export async function awaitPrime(scope: ContextScope, maxMs = 15_000): Promise<"waited" | "none" | "timeout"> {
  const pending = inFlight.get(primeKey(scope));
  if (!pending) return "none";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    pending.then(() => "waited" as const),
    new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), maxMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
  return outcome;
}

/** Test seam. */
export function resetPrimeMemory(): void {
  primed.clear();
  inFlight.clear();
}
