import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateProfileId, validateToolkit } from "@/lib/connectors-shared";
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

    // API-key connectors keep their secret in connector_secrets; drop it too.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("connector_secrets").delete().eq("account_id", row.id);

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
    const { composio, connectedAccountIdentity, driveAccountIdentity } =
      await import("@/lib/composio.server");

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
    if (data.toolkit === "one_drive" || data.toolkit === "sharepoint_graph") {
      const { microsoftIdentity } = await import("@/lib/microsoft.server");
      identity = await microsoftIdentity({
        entityId: profile.id,
        accountId: row.composio_account_id,
      });
    }
    if (!identity) {
      try {
        const account = await composio().connectedAccounts.get(row.composio_account_id);
        identity = connectedAccountIdentity(account as unknown as Record<string, unknown>);
      } catch {
        identity = null;
      }
    }

    return { identity, tools: [] as string[] };
  });

function validateGranolaSave(input: { profile_id?: string | undefined; api_key: string }): {
  profile_id: string | null;
  api_key: string;
} {
  const key = (input?.api_key ?? "").trim();
  if (!key) throw new Error("Paste your Granola API key first.");
  if (key.length > 400) throw new Error("That doesn't look like a Granola API key.");
  return { profile_id: input.profile_id ?? null, api_key: key };
}

/**
 * Granola authenticates with a personal API key rather than OAuth. The key is
 * validated against Granola before it is stored, written with the service role
 * into connector_secrets, and never sent back to the browser.
 */
export const saveGranolaKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateGranolaSave)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { validateGranolaKey, maskKey } = await import("@/lib/granola.server");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    await validateGranolaKey(data.api_key);

    const { data: existing } = await supabase
      .from("connector_accounts")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("toolkit", "granola_mcp")
      .maybeSingle();

    const connectedAt = new Date().toISOString();
    const row = {
      profile_id: profile.id,
      toolkit: "granola_mcp",
      composio_account_id: null,
      status: "connected",
      connected_at: connectedAt,
    };
    const write = existing
      ? await supabase
          .from("connector_accounts")
          .update(row)
          .eq("id", existing.id)
          .select("id")
          .single()
      : await supabase.from("connector_accounts").insert(row).select("id").single();
    if (write.error) throw new Error(write.error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const secret = await supabaseAdmin
      .from("connector_secrets")
      .upsert({ account_id: write.data.id, api_key: data.api_key }, { onConflict: "account_id" });
    if (secret.error) throw new Error(secret.error.message);

    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(supabase, {
      eventType: "connector.enabled",
      orgId: profile.org_id,
      userId,
      dims: { toolkit: "granola_mcp", auth_mode: "api_key" },
    });

    return { status: "connected" as const, masked: maskKey(data.api_key) };
  });

/** Masked key for the card — the plaintext never leaves the server. */
export const getGranolaKeyMask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    const { granolaKeyForProfile, maskKey } = await import("@/lib/granola.server");
    const found = await granolaKeyForProfile(profile.id);
    return { masked: found ? maskKey(found.key) : null };
  });
