import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPartnerSlug } from "@/lib/partners";
import { resolveProfile } from "@/lib/profile-resolve";

/**
 * Pass 185: a workspace was affiliated with an institution at creation. Only
 * the slug travels, from a closed set, and it goes through the ordinary
 * stamped recordEvent path. Never surfaced on failure.
 */
export const noteAffiliatedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { institution: string; profile_id?: string | undefined }) => ({
    institution: isPartnerSlug(input?.institution) ? input.institution : "unknown",
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { ok: true };

    // An unrecognised slug is recorded as "unknown", never dropped. This is
    // the precedent org-type.server.ts sets with workspaceStamp: a failed
    // read and a real value must be tellable apart later, and a dropped
    // event cannot be told apart from an event that never happened.
    // "unknown" makes the gap visible in the dataset.
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
  .inputValidator((input: { institution: string; profile_id?: string | undefined }) => ({
    institution: isPartnerSlug(input?.institution) ? input.institution : "unknown",
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { ok: true };

    // An unrecognised slug is recorded as "unknown", never dropped. This is
    // the precedent org-type.server.ts sets with workspaceStamp: a failed
    // read and a real value must be tellable apart later, and a dropped
    // event cannot be told apart from an event that never happened.
    // "unknown" makes the gap visible in the dataset.
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
