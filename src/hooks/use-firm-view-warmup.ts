import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { firmLiveBoardsQuery } from "@/components/firm/FirmLiveBoards";
import { firmProposalLedgerQuery } from "@/components/firm/FirmProposalsCard";
import { firmCheckLibraryQuery } from "@/hooks/use-firm-dashboard";
import { SHIPPED_WORK_KEY } from "@/hooks/use-shipped-work";
import { listShippedWork } from "@/lib/shipped-work.functions";
import type { ShippedCard } from "@/lib/shipped-work-shared";

/**
 * PERF-4: the Firm view's lower cards only mount once the dashboard counts arrive, so each one used to start its own
 * read after that (about 1.7 s of waiting before the Proposals card even asked). This starts the same reads, with the
 * same keys, the moment an admin or lead opens the page, so the cards find their data in the cache when they mount.
 * Nothing new is read and nothing is shown from here. `profileId` is undefined for anyone who may not see the page,
 * so a manager or analyst triggers nothing.
 */
export function useFirmViewWarmup(profileId: string | undefined): void {
  const client = useQueryClient();
  useEffect(() => {
    if (!profileId) return;
    void client.prefetchQuery(firmLiveBoardsQuery(profileId));
    void client.prefetchQuery(firmProposalLedgerQuery(profileId));
    void client.prefetchQuery(firmCheckLibraryQuery(profileId));
    void client.prefetchQuery({
      queryKey: [...SHIPPED_WORK_KEY],
      queryFn: (): Promise<ShippedCard[]> => listShippedWork(),
      // Fresh long enough for the card that mounts a second later to use it rather than ask again.
      staleTime: 30_000,
    });
  }, [client, profileId]);
}
