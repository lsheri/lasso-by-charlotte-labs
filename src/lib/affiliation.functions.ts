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
 * Pass 186: the student opened the page describing what their school sees.
 * The slug only, from a closed set, through the ordinary stamped
 * recordEvent path, never surfaced on failure.
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

// V6/V7: the self-serve affiliation function and the client-callable
// affiliation event endpoint are both gone. Each trusted a client-supplied
// slug with no entitlement check. An affiliation row is written only by the
// database function redeem_activation_key, and workspace.affiliated is
// recorded only by the redemption server function (redeemActivationKeyFn),
// server side, when that call reports "redeemed", meaning a row was
// actually created. No client can cause the event.
