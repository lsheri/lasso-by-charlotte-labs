import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type ResolvedProfile = {
  id: string;
  org_id: string;
  role: Database["public"]["Enums"]["app_role"];
};

/**
 * A user can hold a profile in several orgs. Server functions therefore never
 * assume a single profile: the client sends the active profile id, and that id
 * is a request rather than a claim. It is verified against the caller's own
 * active profiles, and an id that does not match one of them falls back to the
 * caller's oldest active profile rather than failing, so a stale id in a
 * browser never empties someone's workspace. A deactivated profile never
 * resolves.
 */
export async function resolveProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  profileId?: string | null | undefined,
): Promise<ResolvedProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, org_id, role")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ResolvedProfile[];
  const match = profileId ? rows.find((row) => row.id === profileId) : undefined;
  return match ?? rows[0] ?? null;
}
