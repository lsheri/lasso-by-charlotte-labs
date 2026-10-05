import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { clientKind } from "@/lib/mcp-client-kind";
import { CONNECTION_LIMIT_ERROR } from "@/lib/mcp-connections.functions";
import { revokeOAuthGrant } from "@/lib/oauth-grants.server";
import { recordEvent } from "@/lib/telemetry.server";

type Client = SupabaseClient<Database>;

export type SigninDecision = {
  decision: "approve" | "deny";
  profile_id: string | null;
  client_id: string;
  client_name: string | null;
  redirect_uri: string | null;
};

/** Exact check: this profile, this person, still active. No workspace fallback. */
async function exactProfileOrg(supabase: Client, userId: string, profileId: string | null): Promise<string | null> {
  if (!profileId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", profileId)
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { org_id: string }).org_id;
}

export async function decideSigninCore(
  supabase: Client,
  userId: string,
  input: SigninDecision,
): Promise<{ connection_id: string } | { ok: true }> {
  const orgId = await exactProfileOrg(supabase, userId, input.profile_id);
  const client = clientKind(input.client_name, input.redirect_uri);

  if (input.decision === "deny") {
    if (orgId) {
      await recordEvent(supabase, {
        eventType: "mcp.consent_denied",
        orgId,
        userId,
        profileId: input.profile_id,
        dims: { client },
      });
    }
    return { ok: true };
  }

  if (!orgId || !input.profile_id) throw new Error("not_your_workspace");
  const { data, error } = await supabase.rpc("mcp_bind_signin", {
    p_profile_id: input.profile_id,
    p_oauth_client_id: input.client_id,
    ...(input.client_name ? { p_client_label: input.client_name } : {}),
  });
  if (error) {
    if (error.code === "54000") throw new Error(CONNECTION_LIMIT_ERROR);
    if (error.code === "42501") throw new Error("not_your_workspace");
    throw new Error("bind_failed");
  }
  if (typeof data !== "string" || !data) throw new Error("bind_failed");
  await recordEvent(supabase, {
    eventType: "mcp.connection_created",
    orgId,
    userId,
    profileId: input.profile_id,
    dims: { kind: "signin", client },
  });
  return { connection_id: data };
}

export async function revokeGrantAfterDisconnect(
  supabase: Client,
  connectionId: string,
  revoke: (clientId: string) => Promise<boolean> = revokeOAuthGrant,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("mcp_connections")
      .select("kind, oauth_client_id")
      .eq("id", connectionId)
      .maybeSingle();
    const row = data as { kind?: string | null; oauth_client_id?: string | null } | null;
    if (row?.kind === "signin" && row.oauth_client_id) return await revoke(row.oauth_client_id);
    return false;
  } catch {
    return false;
  }
}
