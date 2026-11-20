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
    const page = await buildEngagementPage(supabase, data.engagement_id, profile.id);
    // D-91: a Member gets each SOW's summary with money removed. The role is the caller's in the board's workspace.
    // Once the SQL floor is pasted, row security hands a Member no SOW extract at all, so the summary is read here
    // with the server client (the item itself was already read under the caller's own policies) and masked.
    const orgId = page.engagement?.org_id;
    const inOrg = orgId ? await resolveProfile(supabase, userId, null, orgId) : null;
    const { seesMoney } = await import("./money-mask-shared");
    if (seesMoney(inOrg?.role)) return page;
    const { sowSummariesForMember } = await import("./money-view.server");
    const rows = page.tasks.flatMap((task) => (task.work_item_tasks ?? []).map((link) => link.work_items)).filter((row) => row !== null);
    const summaries = await sowSummariesForMember(rows);
    if (summaries.size === 0) return page;
    return {
      ...page,
      tasks: page.tasks.map((task) => ({
        ...task,
        work_item_tasks: (task.work_item_tasks ?? []).map((link) =>
          link.work_items && summaries.has(link.work_items.id)
            ? { ...link, work_items: { ...link.work_items, work_item_extracts: [{ summary: summaries.get(link.work_items.id) ?? null }] } }
            : link,
        ),
      })),
    };
  });
