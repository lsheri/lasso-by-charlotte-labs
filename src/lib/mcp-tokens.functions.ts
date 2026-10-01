import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateProfileId } from "@/lib/connectors-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export type McpTokenInfo = {
  id: string;
  created_at: string;
  last_used_at: string | null;
} | null;

export const getMcpToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }): Promise<McpTokenInfo> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return null;
    const { data: token } = await supabase
      .from("mcp_connections")
      .select("id, created_at, last_used_at")
      .eq("profile_id", profile.id)
      .eq("kind", "link")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return token ?? null;
  });

export const createMcpToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: result, error } = await supabase.rpc("mcp_create_connection", {
      p_profile_id: profile.id,
      p_label: "AI connector",
      p_kind: "link",
      p_replace_existing: true,
    });
    if (error) throw new Error(error.message);
    const connection = result as { secret?: string } | null;
    if (!connection?.secret) throw new Error("Could not create connector");
    const { recordSettingsChanged } = await import("./settings-events.server");
    await recordSettingsChanged(
      supabase,
      { orgId: profile.org_id, userId, profileId: profile.id },
      { section: "ai_tools", setting: "mcp_url_regenerated", change: "updated" },
    );
    return { token: connection.secret };
  });

export const revokeMcpToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    const { data: connections, error } = await supabase
      .from("mcp_connections")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("kind", "link")
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    for (const connection of connections ?? []) {
      const { error: revokeError } = await supabase.rpc("mcp_revoke_connection", {
        p_id: connection.id,
      });
      if (revokeError) throw new Error(revokeError.message);
    }
    const { recordSettingsChanged } = await import("./settings-events.server");
    await recordSettingsChanged(
      supabase,
      { orgId: profile.org_id, userId, profileId: profile.id },
      { section: "ai_tools", setting: "mcp_url", change: "removed" },
    );
    return { ok: true };
  });
