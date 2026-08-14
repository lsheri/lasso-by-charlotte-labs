import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * The active checks that apply to one piece of work: written for the whole org,
 * for the engagement this work is mapped into, or for the person who owns it.
 * Read through the caller client so RLS decides what is visible.
 */
export async function applicableFirmChecks(
  supabase: Client,
  args: { orgId: string; ownerProfileId: string; workItemId?: string | null },
): Promise<{ title: string; body: string }[]> {
  let engagementIds: string[] = [];
  if (args.workItemId) {
    const { data: mapped } = await supabase
      .from("work_item_tasks")
      .select("tasks(engagement_id)")
      .eq("work_item_id", args.workItemId);
    engagementIds = Array.from(
      new Set(
        (mapped ?? [])
          .map((row) => (row.tasks as { engagement_id: string } | null)?.engagement_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
  }

  const { data, error } = await supabase
    .from("firm_checks")
    .select("title, body, engagement_id, subject_profile_id, created_at")
    .eq("org_id", args.orgId)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) return [];

  return (data ?? [])
    .filter((check) => {
      const engagementOk =
        check.engagement_id === null || engagementIds.includes(check.engagement_id);
      const subjectOk =
        check.subject_profile_id === null || check.subject_profile_id === args.ownerProfileId;
      return engagementOk && subjectOk;
    })
    .map((check) => ({ title: check.title, body: check.body }));
}

/** The numbered CHECKS block appended to the firm checks system prompt. */
export function renderChecksBlock(checks: { title: string; body: string }[]): string {
  const lines = checks.map((check, index) => `${index + 1}. ${check.title}: ${check.body}`);
  return `CHECKS:\n\n${lines.join("\n")}`;
}
