/**
 * SHARE-1a — sharing one board with the institution that sponsors the
 * workspace. The standing grant already exists as a coaching_links row; the
 * per-board part is coaching_link_engagements, written only through the two
 * subject-only RPCs. Reads go straight from the browser as the subject; no
 * server function is involved.
 *
 * The word "coach" never leaves this file. On every surface the institution
 * is named by its own name.
 */

import { supabase } from "@/integrations/supabase/client";

export type PartnerShare = {
  linkId: string;
  institutionId: string;
  institutionName: string;
  /** Someone at the institution has claimed the link on their side. */
  bound: boolean;
};

/** The joined row shape listMyPartnerShares selects. */
export type PartnerShareRow = {
  id: string;
  coach_profile_id: string | null;
  institution_id: string | null;
  institutions: { id: string; name: string } | null;
};

/** A row without an institution is not a sponsor link and is dropped. */
export function toPartnerShare(row: PartnerShareRow): PartnerShare | null {
  if (!row.institution_id || !row.institutions) return null;
  return {
    linkId: row.id,
    institutionId: row.institution_id,
    institutionName: row.institutions.name,
    bound: row.coach_profile_id !== null,
  };
}

export function toPartnerShares(rows: PartnerShareRow[]): PartnerShare[] {
  const out: PartnerShare[] = [];
  for (const row of rows) {
    const share = toPartnerShare(row);
    if (share) out.push(share);
  }
  return out;
}

/**
 * The person's live sponsor links: not ended, not withdrawn, and pointing at
 * an institution. The subject reads their own links under
 * coaching_links_subject_reads.
 */
export async function listMyPartnerShares(profileId: string): Promise<PartnerShare[]> {
  const { data, error } = await supabase
    .from("coaching_links")
    .select("id, coach_profile_id, institution_id, institutions(id, name)")
    .eq("subject_profile_id", profileId)
    .is("ended_at", null)
    .is("consent_withdrawn_at", null)
    .not("institution_id", "is", null);
  if (error) throw new Error(error.message);
  return toPartnerShares((data ?? []) as unknown as PartnerShareRow[]);
}

/** Engagement ids this link already shares, one row per board. */
export async function listSharedEngagements(linkId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("coaching_link_engagements")
    .select("engagement_id")
    .eq("link_id", linkId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.engagement_id);
}

export async function shareEngagement(linkId: string, engagementId: string): Promise<void> {
  const { error } = await supabase.rpc("share_engagement_with_sponsor", {
    p_link_id: linkId,
    p_engagement_id: engagementId,
  });
  if (error) throw new Error(error.message);
}

export async function unshareEngagement(linkId: string, engagementId: string): Promise<void> {
  const { error } = await supabase.rpc("unshare_engagement_with_sponsor", {
    p_link_id: linkId,
    p_engagement_id: engagementId,
  });
  if (error) throw new Error(error.message);
}

/**
 * SH-3b: what this one board shares of the conversations. The per-board row
 * wins; null there means the link's own setting applies.
 */
export async function getBoardConversationAccess(
  linkId: string,
  engagementId: string,
): Promise<"summaries" | "full"> {
  const [boardRes, linkRes] = await Promise.all([
    supabase
      .from("coaching_link_engagements")
      .select("conversation_access")
      .eq("link_id", linkId)
      .eq("engagement_id", engagementId)
      .maybeSingle(),
    supabase.from("coaching_links").select("conversation_access").eq("id", linkId).maybeSingle(),
  ]);
  const value = boardRes.data?.conversation_access ?? linkRes.data?.conversation_access ?? null;
  return value === "full" ? "full" : "summaries";
}

export async function setBoardConversationAccess(
  linkId: string,
  engagementId: string,
  access: "summaries" | "full",
): Promise<"changed" | "unchanged"> {
  const { data, error } = await supabase.rpc("set_link_board_conversation_access", {
    p_link: linkId,
    p_engagement: engagementId,
    p_access: access,
  });
  // Never show raw database text; callers say it plainly.
  if (error) throw new Error("not_changed");
  const result = data === "changed" ? "changed" : "unchanged";
  if (result === "changed") {
    // SH-3c-1: same event as the member switch, consent-stamped by logEvent.
    const { data: engagement } = await supabase
      .from("engagements")
      .select("org_id")
      .eq("id", engagementId)
      .maybeSingle();
    if (engagement?.org_id) {
      const { logEvent } = await import("@/lib/telemetry");
      logEvent("engagement.access_changed", engagement.org_id, {
        conversations: access,
        result: "changed",
        target: "partner",
      });
    }
  }
  return result;
}
