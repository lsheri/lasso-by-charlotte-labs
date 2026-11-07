import { supabase } from "@/integrations/supabase/client";
import type { ContextScope } from "@/lib/reflect-shared";

/** A primed read set stays warm about five minutes at the provider; re-prime a little before that. */
const PRIME_TTL_MS = 4 * 60 * 1000;
const primed = new Map<string, number>();

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
  }
}

/** Test seam. */
export function resetPrimeMemory(): void {
  primed.clear();
}
