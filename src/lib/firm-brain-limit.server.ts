/**
 * The daily spend limit on firm brain model calls (see firm-brain-limit-shared.ts). Called once before every model
 * request, from the one place models are called (ai.server.ts). It does nothing, and reads nothing, for any surface
 * that is not a firm brain surface.
 *
 * The Kestrel Bay demo firm is left out: rehearsals and live checks run there, and its tour logins have their own
 * limit. If today's spend cannot be read the call goes ahead: this guards cost, not data, and a fault here must not
 * take the firm brain down.
 */

import { FIRM_BRAIN_LIMIT_COPY, FIRM_BRAIN_LIMIT_STATUS, FIRM_BRAIN_SURFACES, firmBrainLimitReached, isFirmBrainSurface, startOfUtcDay, type SpendRow } from "./firm-brain-limit-shared";
import { isDemoFirmSettings } from "./firm-story-shared";

export type FirmBrainLimitMeta = { surface?: string | null | undefined; orgId?: string | null | undefined; profileId?: string | null | undefined } | undefined;

export type FirmBrainLimitDeps = {
  /** Today's firm brain usage rows for one workspace. Throws when the read fails. */
  spendSince: (orgId: string, sinceIso: string) => Promise<SpendRow[]>;
  /** Whether the workspace is the demo firm, by its settings marker (never by id). Throws when the read fails. */
  isDemoFirm?: ((orgId: string) => Promise<boolean>) | undefined;
  now: () => Date;
};

/** Enough rows for any day under the limit: at USD 25 a workspace is refused long before this many calls. */
const ROW_LIMIT = 10_000;

/** The marker barely changes: one read per workspace per ten minutes, not one per model call. */
const demoCache = new Map<string, { demo: boolean; until: number }>();

async function liveDeps(): Promise<FirmBrainLimitDeps> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    now: () => new Date(),
    isDemoFirm: async (orgId) => {
      const cached = demoCache.get(orgId);
      if (cached && cached.until > Date.now()) return cached.demo;
      const { data, error } = await supabaseAdmin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      if (error) throw new Error(error.message);
      const demo = isDemoFirmSettings(data?.settings);
      demoCache.set(orgId, { demo, until: Date.now() + 10 * 60_000 });
      return demo;
    },
    spendSince: async (orgId, sinceIso) => {
      const { data, error } = await supabaseAdmin
        .from("ai_usage")
        .select("profile_id, cost_usd")
        .eq("org_id", orgId)
        .in("surface", [...FIRM_BRAIN_SURFACES])
        .gte("created_at", sinceIso)
        .limit(ROW_LIMIT);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  };
}

/** Resolves when the call may go ahead; throws a 429 Response when the person or the workspace is at its limit. */
export async function assertWithinFirmBrainLimit(meta: FirmBrainLimitMeta, deps?: FirmBrainLimitDeps): Promise<void> {
  if (!meta?.orgId || !isFirmBrainSurface(meta.surface)) return;
  let rows: SpendRow[];
  try {
    const use = deps ?? (await liveDeps());
    // The demo firm is left out. If its marker cannot be read, it is treated as any other workspace.
    if (await (use.isDemoFirm?.(meta.orgId) ?? Promise.resolve(false)).catch(() => false)) return;
    rows = await use.spendSince(meta.orgId, startOfUtcDay(use.now()));
  } catch {
    return;
  }
  const reached = firmBrainLimitReached(rows, meta.profileId);
  if (reached) throw new Response(FIRM_BRAIN_LIMIT_COPY[reached], { status: FIRM_BRAIN_LIMIT_STATUS });
}
