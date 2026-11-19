import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { canCorrectTags } from "@/lib/extract-tags-shared";
import { canAskTheFirm } from "@/lib/firm-ask-shared";

/**
 * Whether the board shows "Tags…" on its cards: in a company workspace, for a workspace admin
 * or the board's lead (its owner). One small read per board for everyone who is not an admin. This only decides what
 * the menu shows; saveItemTagsFn checks the same rule on the server.
 */
export function useCanCorrectTags({
  engagementId,
  profile,
}: {
  engagementId: string;
  profile: { id?: string | null; role?: string | null; org_type?: string | null; has_firm_view?: boolean | null } | null | undefined;
}): boolean {
  const surface = canAskTheFirm(profile);
  const admin = profile?.role === "admin";
  const { data: ownerId } = useQuery({
    queryKey: ["board-lead", engagementId],
    enabled: surface && !admin && Boolean(engagementId) && Boolean(profile?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from("engagements").select("owner_id").eq("id", engagementId).maybeSingle();
      if (error) return null;
      return data?.owner_id ?? null;
    },
  });
  if (!surface) return false;
  return canCorrectTags({ role: profile?.role, isBoardLead: Boolean(profile?.id) && ownerId === profile?.id });
}
