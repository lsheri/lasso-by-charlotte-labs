import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateProfileId } from "@/lib/connectors-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export type ConnectionKind = "link" | "header" | "signin";

export type ConnectionRow = {
  id: string;
  kind: ConnectionKind;
  label: string | null;
  client_name: string | null;
  key_last4: string | null;
  created_at: string;
  last_used_at: string | null;
  can_reveal: boolean;
  older: boolean;
};

/** Thrown message when the database refuses a 26th active connection (errcode 54000). */
export const CONNECTION_LIMIT_ERROR = "connection_limit";

function validateLabel(label: unknown): string {
  const value = typeof label === "string" ? label.trim() : "";
  if (value.length < 1 || value.length > 80) throw new Error("invalid_label");
  return value;
}

function validateId(input: { id?: unknown } | undefined): { id: string } {
  if (!input || typeof input.id !== "string" || !input.id) throw new Error("invalid_id");
  return { id: input.id };
}

export const listConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }): Promise<ConnectionRow[]> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return [];
    const { data: rows, error } = await supabase
      .from("mcp_connections")
      .select(
        "id, kind, label, client_name, key_last4, created_at, last_used_at, vault_secret_id, legacy_token_id",
      )
      .eq("profile_id", profile.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // vault_secret_id and legacy_token_id never leave the server.
    return (rows ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as ConnectionKind,
      label: row.label,
      client_name: row.client_name,
      key_last4: row.key_last4,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      can_reveal: row.vault_secret_id !== null,
      older: row.legacy_token_id !== null,
    }));
  });

export const createConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined; label: string }) => ({
    profile_id: input?.profile_id ?? null,
    label: validateLabel(input?.label),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    const { data: result, error } = await supabase.rpc("mcp_create_connection", {
      p_profile_id: profile.id,
      p_label: data.label,
      p_kind: "link",
      p_replace_existing: false,
    });
    if (error) {
      if (error.code === "54000") throw new Error(CONNECTION_LIMIT_ERROR);
      throw new Error(error.message);
    }
    const connection = result as { id?: string; kind?: string; secret?: string } | null;
    if (!connection?.secret || !connection.id) throw new Error("Could not create connection");
    return { id: connection.id, kind: (connection.kind ?? "link") as ConnectionKind, secret: connection.secret };
  });

export const revealConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateId)
  .handler(async ({ data, context }) => {
    const { data: secret, error } = await context.supabase.rpc("mcp_reveal_connection", {
      p_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { secret: (secret as string | null) ?? null };
  });

export const renameConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; label: string }) => ({
    ...validateId(input),
    label: validateLabel(input?.label),
  }))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("mcp_rename_connection", {
      p_id: data.id,
      p_label: data.label,
    });
    if (error) throw new Error(error.message);
    return { ok: Boolean(ok) };
  });

export const revokeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateId)
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("mcp_revoke_connection", {
      p_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: Boolean(ok) };
  });
