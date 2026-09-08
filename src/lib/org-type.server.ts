/**
 * The acting workspace's type, read server side from the settings jsonb that
 * already exists. Cached per process because it changes at most once, at
 * workspace creation.
 */

const cache = new Map<string, string>();

/** Test seam. */
export function resetOrgTypeCache(): void {
  cache.clear();
}

export function orgTypeFromSettings(settings: unknown): string {
  const value = (settings as Record<string, unknown> | null)?.["type"];
  if (value === "edu" || value === "company") return value;
  return "personal";
}

export async function orgTypeOf(orgId: string | null | undefined): Promise<string> {
  if (!orgId) return "personal";
  const hit = cache.get(orgId);
  if (hit) return hit;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("orgs")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle();
    const type = orgTypeFromSettings(data?.settings ?? null);
    cache.set(orgId, type);
    return type;
  } catch {
    return "personal";
  }
}
