import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** What a person meets when a check was retired between picking it and running. */
export const CHECK_UNAVAILABLE_LINE =
  "That check is no longer available for this work. It may have been retired or it no longer applies here.";

export type CheckScopeRow = {
  engagement_id: string | null;
  subject_profile_id: string | null;
};

/**
 * Whether one check applies to the work under analysis. Pure, so the scoping
 * rule can be tested without a database: org wide checks apply everywhere,
 * engagement checks only inside their engagement, person checks only to the
 * person who owns the work.
 */
export function checkApplies(
  check: CheckScopeRow,
  args: { engagementIds: readonly string[]; ownerProfileId: string },
): boolean {
  const engagementOk =
    check.engagement_id === null || args.engagementIds.includes(check.engagement_id);
  const subjectOk =
    check.subject_profile_id === null || check.subject_profile_id === args.ownerProfileId;
  return engagementOk && subjectOk;
}

/** The engagements one piece of work is mapped into, read through the caller client. */
export async function engagementIdsForWorkItem(
  supabase: Client,
  workItemId: string | null | undefined,
): Promise<string[]> {
  if (!workItemId) return [];
  const { data: mapped } = await supabase
    .from("work_item_tasks")
    .select("tasks(engagement_id)")
    .eq("work_item_id", workItemId);
  return Array.from(
    new Set(
      (mapped ?? [])
        .map((row) => (row.tasks as { engagement_id: string } | null)?.engagement_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

/**
 * ONE check, named by id only. The client never sends check text: the id is
 * resolved here through the caller client, so RLS decides visibility, and the
 * row still has to be active, in the caller's org, and applicable to this work.
 * Null means refuse: the check was retired or does not apply any more.
 */
export async function resolveSingleCheck(
  supabase: Client,
  args: { orgId: string; ownerProfileId: string; workItemId?: string | null; checkId: string },
): Promise<{ title: string; body: string } | null> {
  const { data, error } = await supabase
    .from("firm_checks")
    .select("title, body, engagement_id, subject_profile_id, active, org_id")
    .eq("id", args.checkId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.active !== true || data.org_id !== args.orgId) return null;
  const engagementIds = await engagementIdsForWorkItem(supabase, args.workItemId);
  if (!checkApplies(data, { engagementIds, ownerProfileId: args.ownerProfileId })) return null;
  return { title: data.title, body: data.body };
}

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
  // A read failure is not the same fact as "this firm wrote no checks", so it
  // is never flattened to an empty list here. Callers that must stay resilient
  // use applicableFirmChecksForChat below and accept the documented fallback.
  if (error) {
    console.error("[firm-checks] read failed", {
      orgId: args.orgId,
      ownerProfileId: args.ownerProfileId,
      workItemId: args.workItemId ?? null,
      message: error.message,
    });
    throw new Error(`Firm checks could not be read: ${error.message}`);
  }

  return (data ?? [])
    .filter((check) => checkApplies(check, { engagementIds, ownerProfileId: args.ownerProfileId }))

    .map((check) => ({ title: check.title, body: check.body }));
}

/**
 * The chat path cannot fail a whole answer because the checks table hiccuped,
 * so it falls back to an empty list. The failure is logged loudly and reported
 * back so the caller can tell "read failed" apart from "no checks written".
 */
export async function applicableFirmChecksForChat(
  supabase: Client,
  args: { orgId: string; ownerProfileId: string; workItemId?: string | null },
): Promise<{ checks: { title: string; body: string }[]; readFailed: boolean }> {
  try {
    return { checks: await applicableFirmChecks(supabase, args), readFailed: false };
  } catch (e) {
    console.error("[firm-checks] falling back to no checks for chat:", (e as Error).message);
    return { checks: [], readFailed: true };
  }
}


/** The numbered CHECKS block appended to the firm checks system prompt. */
export function renderChecksBlock(checks: { title: string; body: string }[]): string {
  const lines = checks.map((check, index) => `${index + 1}. ${check.title}: ${check.body}`);
  return `CHECKS:\n\n${lines.join("\n")}`;
}
