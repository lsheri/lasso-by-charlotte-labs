import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { requireConsoleAccess } from "./members.server";
import type { ResolvedProfile } from "./profile-resolve";

/**
 * The firm view is admin or lead, and only in a company workspace. A solo
 * workspace has nobody to aggregate, so the route does not exist for it. The
 * client filter is cosmetic; this is the real gate.
 */
export async function requireFirmView(
  supabase: SupabaseClient<Database>,
  userId: string,
  profileId?: string | null | undefined,
): Promise<{ profile: ResolvedProfile; supabaseAdmin: SupabaseClient<Database> }> {
  const gate = await requireConsoleAccess(supabase, userId, profileId);
  const { data: org } = await gate.supabaseAdmin
    .from("orgs")
    .select("settings")
    .eq("id", gate.profile.org_id)
    .maybeSingle();
  const settings = (org?.settings ?? null) as Record<string, unknown> | null;
  if (settings?.["type"] !== "company") throw new Response("Forbidden", { status: 403 });
  return gate;
}
