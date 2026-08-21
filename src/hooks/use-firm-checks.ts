import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type FirmCheck = {
  id: string;
  org_id: string;
  author_profile_id: string;
  subject_profile_id: string | null;
  engagement_id: string | null;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
};

const COLUMNS =
  "id, org_id, author_profile_id, subject_profile_id, engagement_id, title, body, active, created_at";

/** Plain words for who a check applies to. A check is guidance, never a hidden test. */
export function firmCheckAppliesTo(check: FirmCheck): string {
  if (check.subject_profile_id) return "For one person";
  if (check.engagement_id) return "For this engagement";
  return "For the whole firm";
}

/**
 * The active checks that apply here: written for the whole org, for this
 * engagement, or for this person. Read through the caller client so RLS
 * decides what is visible.
 */
export function useFirmChecks(args: {
  orgId: string | undefined;
  /** A string narrows to that engagement plus org wide; null is org wide only; undefined is any. */
  engagementId?: string | null;
  subjectProfileId?: string | null;
}) {
  const { orgId, engagementId, subjectProfileId } = args;
  return useQuery({
    queryKey: ["firm-checks", orgId, engagementId, subjectProfileId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<FirmCheck[]> => {
      let query = supabase
        .from("firm_checks")
        .select(COLUMNS)
        .eq("org_id", orgId as string)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (engagementId) {
        query = query.or(`engagement_id.is.null,engagement_id.eq.${engagementId}`);
      } else if (engagementId === null) {
        query = query.is("engagement_id", null);
      }
      if (subjectProfileId) {
        query = query.or(`subject_profile_id.is.null,subject_profile_id.eq.${subjectProfileId}`);
      } else if (subjectProfileId === null) {
        query = query.is("subject_profile_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as FirmCheck[];
    },
  });
}

export type NewFirmCheck = {
  orgId: string;
  authorProfileId: string;
  title: string;
  body: string;
  engagementId?: string | null;
  subjectProfileId?: string | null;
};

/**
 * The one write path for a check. RLS requires author_profile_id to be the
 * caller's own profile, so the caller passes its own id and nobody else's.
 * The row is selected back so the surface can show what was actually stored.
 */
export async function insertFirmCheck(input: NewFirmCheck): Promise<FirmCheck> {
  const { data, error } = await supabase
    .from("firm_checks")
    .insert({
      org_id: input.orgId,
      author_profile_id: input.authorProfileId,
      title: input.title.trim(),
      body: input.body.trim(),
      engagement_id: input.engagementId ?? null,
      subject_profile_id: input.subjectProfileId ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as FirmCheck;
}

export function useWriteFirmCheck() {
  const client = useQueryClient();
  const add = useMutation({
    mutationFn: (input: NewFirmCheck) => insertFirmCheck(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["firm-checks"] });
      void client.invalidateQueries({ queryKey: ["firm-check-library"] });
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("firm_checks").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["firm-checks"] });
      void client.invalidateQueries({ queryKey: ["firm-check-library"] });
    },
  });

  return { add, deactivate };
}

