import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { supabase } from "@/integrations/supabase/client";
import { showingsByItem, type ClientShowing } from "@/lib/client-showings-shared";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

export const clientShowingsKey = (engagementId: string) => ["client-showings", engagementId] as const;

export type ClientShowingsApi = {
  enabled: boolean;
  canMark: boolean;
  forItem: (itemId: string) => ClientShowing[];
  mark: (input: { itemId: string; itemType: string; shownOn: string; occasion: string }) => Promise<void>;
  unmark: (showing: ClientShowing) => Promise<void>;
};

const NONE: ClientShowing[] = [];

/**
 * Shown to client marks for one board, read once per board (never per card). Hidden behind company-brain and limited
 * to company workspaces; mark_client_showing and unmark_client_showing check the role again in the database.
 */
export function useClientShowings({
  engagementId,
  profile,
  canEdit,
}: {
  engagementId: string;
  profile: { id?: string | null; org_id?: string | null; org_type?: string | null; has_firm_view?: boolean | null } | null | undefined;
  canEdit: boolean;
}): ClientShowingsApi {
  const flagOn = useFeatureFlag("company-brain");
  const enabled = flagOn && profileHasFirmView(profile as never);
  const queryClient = useQueryClient();
  const orgId = profile?.org_id ?? undefined;

  const query = useQuery({
    queryKey: clientShowingsKey(engagementId),
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_showings")
        .select("id, work_item_id, shown_on, occasion")
        .eq("engagement_id", engagementId);
      if (error) return new Map<string, ClientShowing[]>();
      return showingsByItem(data ?? []);
    },
  });

  const note = (event: "client_showing.marked" | "client_showing.unmarked", dims: Record<string, string>) => {
    if (!orgId) return;
    void import("@/lib/telemetry").then(({ logEvent }) => logEvent(event, orgId, dims)).catch(() => {});
  };

  const markMutation = useMutation({
    mutationFn: async (input: { itemId: string; itemType: string; shownOn: string; occasion: string }) => {
      const occasion = input.occasion.trim();
      const { error } = await supabase.rpc("mark_client_showing", {
        p_engagement: engagementId,
        p_item: input.itemId,
        p_shown_on: input.shownOn,
        ...(occasion ? { p_occasion: occasion } : {}),
      });
      if (error) throw error;
      note("client_showing.marked", { item_type: input.itemType, has_occasion: occasion ? "true" : "false" });
      // 19 Nov, proposal ledger: a proposal shown to the client is "sent to client". The server reads the saved mark
      // itself and dates the ledger from it, so the fact is entered once, here. It never affects the mark.
      const profileId = profile?.id ?? null;
      void import("@/lib/proposal-ledger.functions")
        .then(({ noteProposalShown }) => noteProposalShown({ data: { engagement_id: engagementId, item_id: input.itemId, profile_id: profileId } }))
        .catch(() => {});
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clientShowingsKey(engagementId) }),
  });

  const unmarkMutation = useMutation({
    mutationFn: async (showing: ClientShowing) => {
      const { error } = await supabase.rpc("unmark_client_showing", { p_showing: showing.id });
      if (error) throw error;
      note("client_showing.unmarked", {});
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clientShowingsKey(engagementId) }),
  });

  const byItem = query.data;
  return {
    enabled,
    canMark: enabled && canEdit,
    forItem: (itemId) => byItem?.get(itemId) ?? NONE,
    mark: (input) => markMutation.mutateAsync(input),
    unmark: (showing) => unmarkMutation.mutateAsync(showing),
  };
}
