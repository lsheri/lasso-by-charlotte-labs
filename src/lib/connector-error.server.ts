/**
 * A connector failure is an operational fact, not a story about the user. We
 * record the provider and a coarse class of failure, nothing else: no error
 * strings, no file names, no titles.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { recordEvent } from "@/lib/telemetry.server";
import { logHealth } from "@/lib/health.server";

export type ErrorClass = "auth" | "rate_limit" | "not_found" | "timeout" | "unknown";

/** Coarse bucket only, derived from status codes and error names. */
export function classifyConnectorError(error: unknown): ErrorClass {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 408 || status === 429) return status === 429 ? "rate_limit" : "timeout";
  const name = (error as Error | null)?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  const text = ((error as Error | null)?.message ?? "").toLowerCase();
  if (/unauthor|forbidden|invalid[_ ]?(api[_ ]?key|token)|not connected|credential/.test(text))
    return "auth";
  if (/rate.?limit|too many requests|429/.test(text)) return "rate_limit";
  if (/not found|404|no such/.test(text)) return "not_found";
  if (/timeout|timed out|etimedout/.test(text)) return "timeout";
  return "unknown";
}

/** Fire and forget: reporting a failure must never deepen it. */
export async function reportConnectorError(
  supabase: SupabaseClient<Database>,
  input: { provider: string; error: unknown; orgId?: string | null; userId?: string | null },
): Promise<void> {
  const errorClass = classifyConnectorError(input.error);
  try {
    if (input.orgId) {
      await recordEvent(supabase, {
        eventType: "connector.error",
        orgId: input.orgId,
        userId: input.userId ?? null,
        dims: { provider: input.provider, error_class: errorClass },
      });
    }
  } catch (e) {
    console.error("[connector] event failed:", (e as Error).message);
  }
  void logHealth({
    kind: "error",
    surface: "connector",
    orgId: input.orgId ?? null,
    ownerId: null,
    detail: `connector ${input.provider} failed: ${errorClass}`,
    meta: { provider: input.provider, error_class: errorClass },
  });
}

/** Run connector work, report any failure in coarse form, then rethrow. */
export async function guardConnector<T>(
  supabase: SupabaseClient<Database>,
  info: { provider: string; orgId?: string | null; userId?: string | null },
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    await reportConnectorError(supabase, { ...info, error });
    throw error;
  }
}
