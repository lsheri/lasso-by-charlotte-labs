import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex, validateProfileId } from "@/lib/connectors-shared";
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
    const { data } = await supabase
      .from("mcp_tokens")
      .select("id, created_at, last_used_at")
      .eq("profile_id", profile.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

export const createMcpToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    await supabase
      .from("mcp_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("profile_id", profile.id)
      .is("revoked_at", null);

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error } = await supabase.from("mcp_tokens").insert({
      profile_id: profile.id,
      token_hash: await sha256Hex(token),
      label: "AI connector",
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const revokeMcpToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    const { error } = await supabase
      .from("mcp_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("profile_id", profile.id)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });