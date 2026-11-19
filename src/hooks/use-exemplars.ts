import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";

import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { supabase } from "@/integrations/supabase/client";
import { canMarkExemplar, EXEMPLAR_COPY } from "@/lib/manager-tools-shared";
import { markExemplarFn, unmarkExemplarFn } from "@/lib/manager-tools.functions";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

export const exemplarsKey = (engagementId: string) => ["firm-exemplars", engagementId] as const;

export type ExemplarsApi = {
  enabled: boolean;
  /** Admins and leads only; the server checks again. */
  canMark: boolean;
  has: (itemId: string) => boolean;
  /** Sets or removes the mark. A refusal or failure shows one plain line and leaves the card as it was. */
  toggle: (itemId: string) => Promise<void>;
};

const NONE = new Set<string>();

/**
 * Exemplar marks for one board, read once per board (never per card), for the signed-in board only. The read names
 * the item column alone: who marked is not readable by members and is never asked for. The database shows marks only
 * while the board is shared with the firm, so an unshared board has none. Hidden behind company-brain and limited to
 * company workspaces.
 */
export function useExemplars({
  engagementId,
  profile,
}: {
  engagementId: string;
  profile: { id?: string | null; role?: string | null; is_guest?: boolean | null; org_type?: string | null; has_firm_view?: boolean | null } | null | undefined;
}): ExemplarsApi {
  const flagOn = useFeatureFlag("company-brain");
  const enabled = flagOn && profileHasFirmView(profile as never) && profile?.role !== "coach" && profile?.is_guest !== true;
  const queryClient = useQueryClient();
  const busy = useRef(new Set<string>());

  const query = useQuery({
    queryKey: exemplarsKey(engagementId),
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("firm_exemplars").select("work_item_id").eq("engagement_id", engagementId);
      if (error) return new Set<string>();
      return new Set((data ?? []).map((row) => row.work_item_id));
    },
  });
  const marked = query.data ?? NONE;

  async function toggle(itemId: string) {
    // A second click while the first is still on its way does nothing.
    if (busy.current.has(itemId)) return;
    busy.current.add(itemId);
    try {
      const input = { data: { item_id: itemId, engagement_id: engagementId, profile_id: profile?.id ?? null } };
      const result = marked.has(itemId) ? await unmarkExemplarFn(input) : await markExemplarFn(input);
      if (!result.ok) toast.error(result.refusal);
    } catch {
      toast.error(EXEMPLAR_COPY.failed);
    } finally {
      busy.current.delete(itemId);
      await queryClient.invalidateQueries({ queryKey: exemplarsKey(engagementId) });
    }
  }

  return { enabled, canMark: enabled && canMarkExemplar(profile?.role), has: (itemId) => marked.has(itemId), toggle };
}
