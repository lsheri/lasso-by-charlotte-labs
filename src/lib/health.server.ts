/**
 * Operational health, written to our own database and read later by whoever is
 * looking. The app never calls out to a third party and never reads a secret to
 * decide whether to log. Every org logs, always.
 *
 * Hard rule: nothing the user typed or uploaded may reach `detail` or `meta`.
 * Provider error strings, HTTP statuses, finish reasons, our own reason codes
 * and structural counts only. If the origin of a string is uncertain, log its
 * length instead of the string.
 */

export type HealthKind =
  | "error"
  | "slow"
  | "truncated"
  | "quote_repair"
  | "quote_refusal"
  | "empty_context"
  | "rate_limit"
  | "anomaly";

export type HealthInput = {
  kind: HealthKind;
  surface: string;
  orgId?: string | null | undefined;
  ownerId?: string | null | undefined;
  model?: string | null | undefined;
  latencyMs?: number | null | undefined;
  tokensIn?: number | null | undefined;
  tokensOut?: number | null | undefined;
  detail?: string | null | undefined;
  meta?: Record<string, unknown> | undefined;
};

const DETAIL_CAP = 2000;

/**
 * Never throws, never blocks. Call it without awaiting: a dropped health row is
 * acceptable, a delayed answer is not.
 */
export async function logHealth(input: HealthInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_health_events").insert({
      kind: input.kind,
      surface: input.surface,
      org_id: input.orgId ?? null,
      owner_id: input.ownerId ?? null,
      model: input.model ?? null,
      latency_ms: input.latencyMs ?? null,
      tokens_in: input.tokensIn ?? null,
      tokens_out: input.tokensOut ?? null,
      detail: input.detail ? input.detail.slice(0, DETAIL_CAP) : null,
      meta: (input.meta ?? {}) as never,
    });
    if (error) console.error("[health] insert failed:", error.message);
  } catch (e) {
    console.error("[health] log failed:", (e as Error).message);
  }
}

/**
 * AUDIT-1 (7 Nov 2026): the same unreadable item was logged on every read
 * (94 of 164 empty_context rows in one week came from four items), which
 * drowned the health channel. One row per key per UTC day; the key is a
 * reason code plus an item id, never text. Process-local on purpose: a second
 * server instance may write a second row, and that is cheaper than a table.
 */
const loggedToday = new Map<string, string>();
const LOGGED_TODAY_CAP = 5000;

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** True the first time a key is seen on a given UTC day, false after that. */
export function healthFirstToday(key: string, now: number = Date.now()): boolean {
  const day = utcDay(now);
  if (loggedToday.get(key) === day) return false;
  if (loggedToday.size >= LOGGED_TODAY_CAP) loggedToday.clear();
  loggedToday.set(key, day);
  return true;
}

/** Test seam. */
export function resetHealthDedupe(): void {
  loggedToday.clear();
}

/** logHealth, at most once per key per UTC day. */
export async function logHealthOncePerDay(key: string, input: HealthInput): Promise<void> {
  if (!healthFirstToday(key)) return;
  await logHealth(input);
}
