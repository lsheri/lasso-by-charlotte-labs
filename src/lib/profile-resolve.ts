import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type ResolvedProfile = {
  id: string;
  org_id: string;
  role: Database["public"]["Enums"]["app_role"];
};

/**
 * A user can hold a profile in several orgs. Server functions therefore never
 * assume a single profile: the client sends the active profile id, and we
 * verify it belongs to the caller. Without one we fall back to their oldest
 * profile so single-org users need no extra wiring.
 */
export async function resolveProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  profileId?: string | null | undefined,
): Promise<ResolvedProfile | null> {
  let query = supabase.from("profiles").select("id, org_id, role").eq("user_id", userId);
  if (profileId) query = query.eq("id", profileId);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as ResolvedProfile | undefined) ?? null;
}
