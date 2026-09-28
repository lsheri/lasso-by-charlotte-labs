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

/** An affiliation is a signup-time act. One hour is generous for a slow sign up
 *  and still refuses a drive-by call weeks later. */
export const AFFILIATION_WINDOW_MS = 60 * 60 * 1000;

/**
 * True when createdAt falls inside the affiliation window. Absent or
 * unparseable timestamps are outside the window, never inside it.
 */
export function withinAffiliationWindow(
  createdAt: string | null | undefined,
  now: number,
): boolean {
  if (createdAt === null || createdAt === undefined || createdAt === "") return false;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;
  return now - created <= AFFILIATION_WINDOW_MS;
}

// V6: the self-serve affiliation server function is deleted. It trusted a
// client-supplied profile_id and slug with no entitlement check, so any
// signed-in person could self-affiliate. The activation key
// (redeemActivationKeyFn) is now the only way an affiliation is written.
// The workspace.affiliated event stays registered; its call site is the
// redemption path.
