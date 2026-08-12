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
