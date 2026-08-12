import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

/**
 * Owners always see the truth about their own record. Coaches see what the org
 * decided: a neutral mark when vendor_display is vendor_neutral.
 */
export function useVendorVisible(): boolean {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id ?? null;
  const { data } = useQuery({
    queryKey: ["org-vendor-display", orgId],
    enabled: Boolean(orgId),
    staleTime: 300_000,
    queryFn: async () => {
      const { data: org } = await supabase
        .from("orgs")
        .select("vendor_display")
        .eq("id", orgId!)
        .maybeSingle();
      return org?.vendor_display ?? "vendor_named";
    },
  });
  if (profile?.role !== "coach") return true;
  return data !== "vendor_neutral";
}
