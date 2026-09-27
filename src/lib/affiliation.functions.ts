import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPartnerSlug, type PartnerSlug } from "@/lib/partners";
import { resolveProfile } from "@/lib/profile-resolve";

/**
 * Which institution value a telemetry call should record, or null for none.
 * A real partner link always sends something, so a genuine gap still shows up
 * as "unknown"; calling the endpoint with no arguments no longer writes a row.
 */
export function institutionToRecord(value: unknown): PartnerSlug | "unknown" | null {
  if (isPartnerSlug(value)) return value;
  if (typeof value === "string" && value.length > 0) return "unknown";
  return null;
}

/**
 * Pass 185: a workspace was affiliated with an institution at creation. Only
 * the slug travels, from a closed set, and it goes through the ordinary
 * stamped recordEvent path. Never surfaced on failure.
 */
export const noteAffiliatedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { institution: string; profile_id?: string | undefined }) => ({
    institution: institutionToRecord(input?.institution),
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (data.institution === null) return { ok: true };

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
    institution: institutionToRecord(input?.institution),
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (data.institution === null) return { ok: true };

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

/**
 * Pass V4: the affiliation implied by a partner front door, written server
 * side because org_affiliations has no client insert policy. An affiliation
 * is a real row, so unlike the telemetry functions it is never written on a
 * guess: a non-partner slug writes nothing.
 */
export const affiliateWorkspaceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { institution: string; profile_id?: string | undefined }) => ({
    institution: isPartnerSlug(input?.institution) ? input.institution : null,
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // An affiliation must never block someone finishing sign up.
    try {
      const { supabase, userId } = context;
      if (data.institution === null) return { ok: true };

      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) return { ok: true };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: institution } = await supabaseAdmin
        .from("institutions")
        .select("id")
        .eq("slug", data.institution)
        .maybeSingle();
      if (!institution?.id) return { ok: true };

      // Unique on org_id: a retry cannot make a second row, and a person who
      // already has an affiliation keeps the first one.
      const { error } = await supabaseAdmin
        .from("org_affiliations")
        .upsert(
          { org_id: profile.org_id, institution_id: institution.id, created_by: profile.id },
          { onConflict: "org_id" },
        );
      if (error) return { ok: true };

      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "workspace.affiliated",
        orgId: profile.org_id,
        userId,
        profileId: profile.id,
        dims: { institution: data.institution },
      });
    } catch {
      /* an affiliation is never a gate on finishing sign up */
    }
    return { ok: true };
  });
