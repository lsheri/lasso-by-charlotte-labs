import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isConnectorToolkit, type ConnectorToolkit } from "@/lib/connector-toolkits";

function validateToolkit(input: { toolkit: string }): { toolkit: ConnectorToolkit } {
  if (!input || !isConnectorToolkit(input.toolkit)) throw new Error("Unsupported connector");
  return { toolkit: input.toolkit };
}

export const initiateConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateToolkit)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveAuthConfigId, composio } = await import("@/lib/composio.server");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
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

export const syncDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { listDriveFiles } = await import("@/lib/composio.server");
    const { driveWorkType } = await import("@/lib/connector-toolkits");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: account } = await supabase
      .from("connector_accounts")
      .select("status")
      .eq("profile_id", profile.id)
      .eq("toolkit", "googledrive")
      .maybeSingle();
    if (account?.status !== "connected") throw new Error("Connect Google Drive first");

    const files = await listDriveFiles(profile.id, 20);

    const { data: existing } = await supabase
      .from("work_items")
      .select("meta")
      .eq("owner_id", profile.id)
      .eq("source", "connector:googledrive");
    const seen = new Set(
      (existing ?? [])
        .map((row) => (row.meta as { drive_file_id?: string } | null)?.drive_file_id)
        .filter((id): id is string => Boolean(id)),
    );

    let imported = 0;
    let skipped = 0;
    for (const file of files) {
      if (!file.id || seen.has(file.id)) {
        skipped += 1;
        continue;
      }
      const insert = await supabase.from("work_items").insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type: driveWorkType(file.mimeType),
        source: "connector:googledrive",
        title: file.name ?? "Untitled file",
        visibility: "unmapped",
        ts_precision: "source",
        created_at_source: file.modifiedTime ?? null,
        meta: {
          drive_file_id: file.id,
          mime_type: file.mimeType ?? null,
          web_view_link: file.webViewLink ?? null,
        },
      });
      if (insert.error) throw new Error(insert.error.message);
      seen.add(file.id);
      imported += 1;
    }

    const tenantHash = await sha256Hex(profile.org_id);
    await supabase.from("events").insert({
      event_type: "connector.synced",
      schema_version: "v1",
      tenant_hash: tenantHash,
      dims: { toolkit: "googledrive", imported },
      payload: {},
    });

    return { imported, skipped };
  });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}