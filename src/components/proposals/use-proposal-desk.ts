import { useQuery } from "@tanstack/react-query";

import type { DeskList } from "@/lib/proposal-desk-shared";
import { listProposalsFn } from "@/lib/proposal-desk.functions";

/**
 * The one read behind the proposals dashboard, shared by the Proposals page and the admin's Home so both show the
 * same rows from the same cache. Pass no profile id and nothing is asked.
 */
export function useProposalDesk(profileId: string | undefined, options: { refreshMs?: number } = {}) {
  return useQuery({
    queryKey: ["proposal-desk", profileId],
    enabled: Boolean(profileId),
    staleTime: 30_000,
    retry: false,
    queryFn: (): Promise<DeskList> => listProposalsFn({ data: { profile_id: profileId as string } }),
    // While an ask waits for its reply the page looks again every few seconds, so "said yes" shows without a reload.
    // An admin's Home also reads again once a minute (D-85), and on focus, which is react-query's own default.
    refetchInterval: (query) => (query.state.data?.proposals.some((proposal) => proposal.ask?.waiting) ? 5000 : (options.refreshMs ?? false)),
  });
}
