import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pass 185: a workspace was affiliated with an institution at creation. Only
 * the slug travels, from a closed set, and it goes through the ordinary
 * stamped recordEvent path. Never surfaced on failure.
 */
export const noteAffiliatedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { institution: string }) => ({
    institution: input?.institution === "ceiba_uni" ? input.institution : "",
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.institution) return { ok: true };
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { ok: true };

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "workspace.affiliated",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: { institution: data.institution },
    });
    return { ok: true };
  });

/**
 * Pass 186: the student opened the page describing what their school sees.
 * Same shape as noteAffiliatedFn: the slug only, from a closed set, through
 * the ordinary stamped recordEvent path, never surfaced on failure.
 */
export const noteDisclosureReadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { institution: string }) => ({
    institution: input?.institution === "ceiba_uni" ? input.institution : "",
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.institution) return { ok: true };
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { ok: true };

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "affiliation.disclosure_read",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: { institution: data.institution },
    });
    return { ok: true };
  });
