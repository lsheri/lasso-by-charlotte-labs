import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";

import { useProfile } from "@/hooks/use-profile";
import { RECHECK_INTERVAL_MS } from "@/lib/document-recheck-shared";
import { recheckDocuments } from "@/lib/document-recheck.functions";

/**
 * Wakes the recheck pass. The real debounce lives on the server, in the
 * per-document timestamps; this renders nothing and shows nothing.
 */
export function DocumentRecheck() {
  const { data: profile } = useProfile();
  const run = useServerFn(recheckDocuments);
  const queryClient = useQueryClient();
  const settled = useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: ["document-recheck", profile?.id],
    queryFn: () => run({ data: { profile_id: profile?.id } }),
    enabled: Boolean(profile?.id),
    staleTime: RECHECK_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });

  const changed = data?.changed ?? 0;
  useEffect(() => {
    if (changed <= 0 || settled.current === changed) return;
    settled.current = changed;
    void queryClient.invalidateQueries({ queryKey: ["work-items"] });
    void queryClient.invalidateQueries({ queryKey: ["document-versions"] });
  }, [changed, queryClient]);

  return null;
}
