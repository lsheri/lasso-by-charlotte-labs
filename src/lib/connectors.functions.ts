import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateToolkit } from "@/lib/connectors-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export const initiateConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateToolkit)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveAuthConfigId, composio } = await import("@/lib/composio.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const authConfigId = await resolveAuthConfigId(data.toolkit);
    const request = await composio().connectedAccounts.link(profile.id, authConfigId);

    const { data: existing } = await supabase
      .from("connector_accounts")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("toolkit", data.toolkit)
      .maybeSingle();

    const row = {
      profile_id: profile.id,
      toolkit: data.toolkit,
      composio_account_id: request.id,
      status: "pending",
      connected_at: null,
    };
    const write = existing
      ? await supabase.from("connector_accounts").update(row).eq("id", existing.id)
      : await supabase.from("connector_accounts").insert(row);
    if (write.error) throw new Error(write.error.message);

    return { redirect_url: request.redirectUrl ?? null, status: "pending" as const };
  });

export const getConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateToolkit)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { composio } = await import("@/lib/composio.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: row } = await supabase
      .from("connector_accounts")
      .select("id, status, composio_account_id, connected_at")
      .eq("profile_id", profile.id)
      .eq("toolkit", data.toolkit)
      .maybeSingle();
    if (!row?.composio_account_id) {
      return { status: row?.status ?? "not_connected", connected_at: row?.connected_at ?? null };
    }

    let remoteStatus = "";
    try {
      const account = await composio().connectedAccounts.get(row.composio_account_id);
      remoteStatus = String(account.status ?? "").toUpperCase();
    } catch {
      return { status: row.status, connected_at: row.connected_at };
    }

    if (remoteStatus === "ACTIVE") {
      const connectedAt = row.connected_at ?? new Date().toISOString();
      await supabase
        .from("connector_accounts")
        .update({ status: "connected", connected_at: connectedAt })
        .eq("id", row.id);
      return { status: "connected" as const, connected_at: connectedAt };
    }

    if (remoteStatus === "FAILED" || remoteStatus === "EXPIRED" || remoteStatus === "INACTIVE") {
      await supabase.from("connector_accounts").update({ status: "disconnected" }).eq("id", row.id);
      return { status: "disconnected" as const, connected_at: null };
    }

    return { status: row.status, connected_at: row.connected_at };
  });

export const disconnectConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateToolkit)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { composio } = await import("@/lib/composio.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: row } = await supabase
      .from("connector_accounts")
      .select("id, composio_account_id")
      .eq("profile_id", profile.id)
      .eq("toolkit", data.toolkit)
      .maybeSingle();
    if (!row) return { status: "not_connected" as const };

    if (row.composio_account_id) {
      try {
        await composio().connectedAccounts.delete(row.composio_account_id);
      } catch {
        /* the local record is still cleared below */
      }
    }

    const upd = await supabase
      .from("connector_accounts")
      .update({ status: "disconnected", composio_account_id: null, connected_at: null })
      .eq("id", row.id);
    if (upd.error) throw new Error(upd.error.message);
    return { status: "disconnected" as const };
  });

/**
 * Connector metadata for the cards: which account is actually linked, and (for
 * MCP-backed toolkits) which actions that connection publishes. Import is never
 * triggered here — explicit selection in the picker is the only import path.
 */
export const getConnectorDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateToolkit)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { composio, connectedAccountIdentity, driveAccountIdentity, granolaTools } = await import(
      "@/lib/composio.server"
    );

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: row } = await supabase
      .from("connector_accounts")
      .select("status, composio_account_id, connected_at")
      .eq("profile_id", profile.id)
      .eq("toolkit", data.toolkit)
      .maybeSingle();

    if (row?.status !== "connected" || !row.composio_account_id) {
      return { identity: null as string | null, tools: [] as string[] };
    }

    let identity: string | null = null;
    if (data.toolkit === "googledrive") {
      // Drive publishes the signed-in user directly; that beats OAuth metadata.
      identity = await driveAccountIdentity(profile.id);
    }
    if (!identity) {
      try {
        const account = await composio().connectedAccounts.get(row.composio_account_id);
        identity = connectedAccountIdentity(account as unknown as Record<string, unknown>);
      } catch {
        identity = null;
      }
    }

    const tools = data.toolkit === "granola_mcp" ? await granolaTools(profile.id).catch(() => []) : [];
    return { identity, tools };
  });
