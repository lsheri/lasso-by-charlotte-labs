import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { withKind, type EngagementKind } from "@/lib/edu-kinds";

/** The workspace settings jsonb, read once and shared by every school surface. */
export function useOrgSettings() {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;
  return useQuery({
    queryKey: ["org-settings", orgId ?? null],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase
        .from("orgs")
        .select("settings")
        .eq("id", orgId as string)
        .maybeSingle();
      if (error) throw error;
      return (data?.settings ?? {}) as Record<string, unknown>;
    },
  });
}

export async function saveEngagementKind(
  orgId: string,
  engagementId: string,
  kind: EngagementKind,
): Promise<void> {
  const { data } = await supabase.from("orgs").select("settings").eq("id", orgId).maybeSingle();
  const next = withKind((data?.settings ?? {}) as Record<string, unknown>, engagementId, kind);
  const { error } = await supabase.from("orgs").update({ settings: next as never }).eq("id", orgId);
  if (error) throw error;
}

export function useSaveEngagementKind() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { engagementId: string; kind: EngagementKind }) =>
      saveEngagementKind(profile?.org_id as string, input.engagementId, input.kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-settings"] }),
  });
}
