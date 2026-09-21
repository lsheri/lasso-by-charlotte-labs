/**
 * S2: the entry points for giving and taking away what someone has on a board.
 *
 * Both need a verified session and run as that person, the same way the board
 * link functions do. The database function decides every refusal.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  accessResult,
  isEngagementAccessValue,
  type EngagementPeoplePayload,
  type AccessResult,
} from "@/lib/engagement-access-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export const listEngagementPeopleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<EngagementPeoplePayload> => {
    const empty: EngagementPeoplePayload = { people: [], canShare: false };
    if (!data.engagement_id) return empty;
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return empty;
    const { listEngagementPeople } = await import("@/lib/engagement-access.server");
    return listEngagementPeople(context.supabase, data.engagement_id, profile);
  });

export type SetAccessAnswer =
  | { status: "done"; result: AccessResult }
  | { status: "refused" };

export const setEngagementPersonAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; person_id: string; access: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    person_id: typeof input?.person_id === "string" ? input.person_id : "",
    access: typeof input?.access === "string" ? input.access : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<SetAccessAnswer> => {
    if (!data.engagement_id || !data.person_id) return { status: "refused" };
    if (!isEngagementAccessValue(data.access)) return { status: "refused" };
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return { status: "refused" };

    const { setPersonAccess } = await import("@/lib/engagement-access.server");
    const outcome = await setPersonAccess(
      context.supabase,
      data.engagement_id,
      data.person_id,
      data.access,
    );
    if (outcome.status !== "done") return { status: "refused" };

    const result = accessResult(outcome.returned, outcome.previous);
    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "engagement.access_changed",
      orgId: profile.org_id,
      userId: context.userId,
      profileId: profile.id,
      dims: { access: data.access, result },
    });
    return { status: "done", result };
  });
