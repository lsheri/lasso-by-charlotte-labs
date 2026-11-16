import { useQuery } from "@tanstack/react-query";

import { useProfile } from "@/hooks/use-profile";
import { listMyPartnerShares, listSharedEngagements } from "@/lib/partner-share";

export const boardsSharedUpKey = (profileId: string | undefined) => ["boards-shared-up", profileId] as const;

/**
 * Which of the person's own boards are shared live with the firm or school they are affiliated with, and with whom
 * (Liam, 15 Nov: a shared board stays in its owner's menu, so the menu should say it is shared). Board id to the
 * institution names. Empty for anyone with no sponsor link, which is most people.
 */
export function useBoardsSharedUp(): Map<string, string[]> {
  const { data: profile } = useProfile();
  const profileId = profile?.id;
  const { data } = useQuery({
    queryKey: boardsSharedUpKey(profileId),
    enabled: Boolean(profileId),
    staleTime: 60_000,
    queryFn: async (): Promise<[string, string[]][]> => {
      const shares = await listMyPartnerShares(profileId as string);
      const byBoard = new Map<string, string[]>();
      for (const share of shares) {
        for (const boardId of await listSharedEngagements(share.linkId)) {
          byBoard.set(boardId, [...(byBoard.get(boardId) ?? []), share.institutionName]);
        }
      }
      return [...byBoard];
    },
  });
  return new Map(Array.isArray(data) ? data : []);
}
