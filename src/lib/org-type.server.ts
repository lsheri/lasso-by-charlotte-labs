/**
 * The acting workspace's type, read server side from the settings jsonb that
 * already exists. The type is cached briefly because it is read on every
 * event, and it can change, so the cache expires rather than persisting for
 * the life of the process.
 */

const ORG_TYPE_TTL_MS = 10_000;

const cache = new Map<string, { at: number; value: string }>();

/** Test seam. */
export function resetOrgTypeCache(): void {
  cache.clear();
}

export function orgTypeFromSettings(settings: unknown): string {
  const value = (settings as Record<string, unknown> | null)?.["type"];
  // This stamps events.workspace_type, which is immutable. A partner workspace read as "personal" here is wrong forever, not just until the next deploy.
  if (value === "edu" || value === "company" || value === "partner") return value;
  return "personal";
}

/**
 * The type as actually read, or null when the read failed. Callers that only
 * need a label can fall back; callers that stamp an immutable column must not,
 * because a guessed stamp cannot be told apart from a real one later.
 */
export async function orgTypeOfStrict(
  orgId: string | null | undefined,
): Promise<string | null> {
  if (!orgId) return null;
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < ORG_TYPE_TTL_MS) return hit.value;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orgs")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle();
    if (error) return null;
    const type = orgTypeFromSettings(data?.settings ?? null);
    cache.set(orgId, { at: Date.now(), value: type });
    return type;
  } catch {
    return null;
  }
}

const affiliationCache = new Map<string, { at: number; value: boolean }>();

/** Test seam. */
export function resetAffiliationCache(): void {
  affiliationCache.clear();
}

/**
 * Whether the workspace is affiliated with an institution, as actually read,
 * or null when the read failed. Same cache window as the type, for the same
 * reason: it is read on every event.
 */
export async function isAffiliatedStrict(orgId: string): Promise<boolean | null> {
  if (!orgId) return null;
  const hit = affiliationCache.get(orgId);
  if (hit && Date.now() - hit.at < ORG_TYPE_TTL_MS) return hit.value;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("org_affiliations")
      .select("id")
      .eq("org_id", orgId)
      .maybeSingle();
    if (error) return null;
    const value = Boolean(data?.id);
    affiliationCache.set(orgId, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

const partnerCache = new Map<string, { at: number; value: string | null }>();

/** Test seam. */
export function resetPartnerCache(): void {
  partnerCache.clear();
}

/**
 * PH-S1: the institution slug of the workspace's affiliation, or null when
 * there is none or the read failed. Read only, same cache window as above.
 */
export async function partnerSlugOf(orgId: string | null | undefined): Promise<string | null> {
  if (!orgId) return null;
  const hit = partnerCache.get(orgId);
  if (hit && Date.now() - hit.at < ORG_TYPE_TTL_MS) return hit.value;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("org_affiliations")
      .select("institutions(slug)")
      .eq("org_id", orgId)
      .maybeSingle();
    if (error) return null;
    const row = data as unknown as { institutions: { slug: string } | null } | null;
    const value = row?.institutions?.slug ?? null;
    partnerCache.set(orgId, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

const accountStageCache = new Map<string, { at: number; value: string | null }>();

/** Test seam. */
export function resetAccountStageCache(): void {
  accountStageCache.clear();
}

/**
 * A-S2: the account stage of the workspace ('internal' | 'pilot' | 'customer'
 * | 'free' | 'none'), read through the service-role-only account_stage()
 * function. Mirror-only: this never lands on the events row. Read only, same
 * cache window as above. Null when there is no org, the read fails, or
 * anything throws. Never throws.
 */
export async function accountStageOf(orgId: string | null | undefined): Promise<string | null> {
  if (!orgId) return null;
  const hit = accountStageCache.get(orgId);
  if (hit && Date.now() - hit.at < ORG_TYPE_TTL_MS) return hit.value;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // account_stage is not in the generated types; cast locally at the call site.
    const { data, error } = await (supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)("account_stage", {
      p_org: orgId,
    });
    if (error) return null;
    const value = typeof data === "string" ? data : null;
    accountStageCache.set(orgId, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

export async function orgTypeOf(orgId: string | null | undefined): Promise<string> {
  return (await orgTypeOfStrict(orgId)) ?? "personal";
}

/**
 * The two workspace dimensions stamped onto every event at write time, the
 * same way the consent tier is. They are stamped, never joined at read time:
 * a workspace can change type, and a join would silently rewrite history.
 */
export type WorkspaceStamp = { workspace_type: string; affiliated: boolean | null };

export async function workspaceStamp(
  orgId: string | null | undefined,
): Promise<WorkspaceStamp> {
  // No workspace at all: an anonymous marketing view. "none" rather than null,
  // so a missing stamp can never be mistaken for a bug.
  if (!orgId) return { workspace_type: "none", affiliated: null };
  const type = await orgTypeOfStrict(orgId);
  // A failed read is "unknown", never a guess. This column is immutable once
  // written, and a wrong value is indistinguishable from a right one forever.
  if (type === null) return { workspace_type: "unknown", affiliated: null };
  // Affiliation is read here and nowhere else. A failed affiliation read is
  // null, never false: unaffiliated and unknown are different facts.
  const affiliated = await isAffiliatedStrict(orgId);
  return { workspace_type: type, affiliated };
}
