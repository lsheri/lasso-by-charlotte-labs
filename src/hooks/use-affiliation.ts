import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

export type AffiliatedInstitution = { id: string; name: string; slug: string };

/**
 * Pass 186: the institution the acting profile's workspace is affiliated
 * with, or null when there is no org_affiliations row. A failed read is
 * indistinguishable from no row on purpose: the nav item and the page both
 * quietly render their unaffiliated state rather than an error.
 */
export function useAffiliation() {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;
  return useQuery({
    queryKey: ["affiliation", orgId],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async (): Promise<{ institution: AffiliatedInstitution | null }> => {
      try {
        const { data, error } = await supabase
          .from("org_affiliations")
          .select("institutions(id, name, slug)")
          .eq("org_id", orgId as string)
          .maybeSingle();
        if (error) return { institution: null };
        const row = data as unknown as {
          institutions: AffiliatedInstitution | null;
        } | null;
        return { institution: row?.institutions ?? null };
      } catch {
        return { institution: null };
      }
    },
  });
}
