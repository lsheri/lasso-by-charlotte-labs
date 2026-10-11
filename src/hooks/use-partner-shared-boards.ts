import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

/** MN-5: one board a person shared with this partner workspace via a live link. */
export type PartnerSharedBoard = {
  link_id: string;
  shared_by: string;
  board_id: string;
  title: string;
  code: string | null;
};

export type PartnerSharedGroup = { sharedBy: string; boards: PartnerSharedBoard[] };

export const partnerSharedBoardsKey = (profileId: string | undefined) =>
  ["partner-shared-boards", profileId] as const;

export async function fetchPartnerSharedBoards(): Promise<PartnerSharedBoard[]> {
  const { data, error } = await supabase.rpc("partner_shared_boards");
  if (error) throw error;
  const boards = (data as { boards?: PartnerSharedBoard[] } | null)?.boards;
  return Array.isArray(boards) ? boards : [];
}

/** Grouped by the person who shared, in the order the list names them. */
export function groupBySharer(boards: PartnerSharedBoard[]): PartnerSharedGroup[] {
  const groups: PartnerSharedGroup[] = [];
  for (const board of boards) {
    let group = groups.find((g) => g.sharedBy === board.shared_by);
    if (!group) {
      group = { sharedBy: board.shared_by, boards: [] };
      groups.push(group);
    }
    group.boards.push(board);
  }
  return groups;
}

/** Enabled only while the active workspace is a partner workspace. Cached, never polled. */
export function usePartnerSharedBoards() {
  const { data: profile } = useProfile();
  const enabled = profile?.org_type === "partner" && Boolean(profile?.id);
  return useQuery({
    queryKey: partnerSharedBoardsKey(profile?.id),
    queryFn: fetchPartnerSharedBoards,
    enabled,
    staleTime: 60_000,
  });
}
