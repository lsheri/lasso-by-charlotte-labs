import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Input = { profile_id?: string | undefined } | undefined;

export type RecheckResult = {
  checked: number;
  changed: number;
  refreshed: number;
  skipped: number;
};

/**
 * One debounced pass over connected documents. The stored timestamps are the
 * real guard, so calling this on every page load is safe.
 */
export const recheckDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => ({ profile_id: input?.profile_id ?? null }))
  .handler(async ({ data, context }): Promise<RecheckResult> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { checked: 0, changed: 0, skipped: 0 };

    const { recheckConnectedDocuments } = await import("@/lib/document-recheck.server");
    const result = await recheckConnectedDocuments(supabase, {
      profileId: profile.id,
      userId,
    }).catch(() => ({ checked: 0, changed: 0, skipped: 0 }));

    if (result.checked > 0) {
      const { recordEvent } = await import("@/lib/telemetry.server");
      await recordEvent(supabase, {
        eventType: "document.recheck_ran",
        orgId: profile.org_id,
        userId,
        dims: { source: "googledrive", checked: result.checked, changed: result.changed },
      });
      for (let i = 0; i < result.changed; i += 1) {
        await recordEvent(supabase, {
          eventType: "document.version_recorded",
          orgId: profile.org_id,
          userId,
          dims: { source: "googledrive", reason: "scheduled_recheck" },
        });
      }
    }
    return result;
  });

/** The per-account switch behind the recheck pass. Absent means on. */
export const getDocumentRecheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => ({ profile_id: input?.profile_id ?? null }))
  .handler(async ({ data, context }): Promise<{ enabled: boolean; connected: boolean }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { enabled: true, connected: false };

    const { parseWatchConfig } = await import("@/lib/connector-watch-shared");
    const { data: row } = await supabase
      .from("connector_accounts")
      .select("status, watch_config")
      .eq("profile_id", profile.id)
      .eq("toolkit", "googledrive")
      .maybeSingle();
    return {
      enabled: parseWatchConfig(row?.watch_config).recheck_documents,
      connected: row?.status === "connected",
    };
  });

export const setDocumentRecheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined; enabled: boolean }) => ({
    profile_id: input?.profile_id ?? null,
    enabled: input?.enabled !== false,
  }))
  .handler(async ({ data, context }): Promise<{ enabled: boolean }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { parseWatchConfig } = await import("@/lib/connector-watch-shared");
    const { data: row, error } = await supabase
      .from("connector_accounts")
      .select("id, watch_config")
      .eq("profile_id", profile.id)
      .eq("toolkit", "googledrive")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That connection has expired. Reconnect it on Where work lives.");

    const config = { ...parseWatchConfig(row.watch_config), recheck_documents: data.enabled };
    const update = await supabase
      .from("connector_accounts")
      .update({
        watch_config:
          config as unknown as Database["public"]["Tables"]["connector_accounts"]["Row"]["watch_config"],
      })
      .eq("id", row.id);
    if (update.error) throw new Error(update.error.message);
    return { enabled: data.enabled };
  });
