import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { EMPTY_ENGAGEMENT_PAGE, type EngagementPagePayload } from "./engagement-page-shared";

type Input = { engagement_id: string; profile_id?: string | null };

/**
 * The six engagement scoped reads the page used to make, collapsed into one
 * call on the caller's own client. Nothing here widens access: the profile is
 * verified as the caller's own and every read is subject to the same policies.
 */
export const getEngagementPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => ({
    engagement_id: String(input.engagement_id ?? ""),
    profile_id: input.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<EngagementPagePayload> => {
    if (!data.engagement_id) return EMPTY_ENGAGEMENT_PAGE;
    const { supabase, userId } = context;

    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return EMPTY_ENGAGEMENT_PAGE;

    const { buildEngagementPage } = await import("./engagement-page.server");
    return buildEngagementPage(supabase, data.engagement_id, profile.id);
  });
