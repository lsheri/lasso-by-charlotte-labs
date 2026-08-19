import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
import { getEngagementPage } from "@/lib/engagement-page.functions";
import {
  EMPTY_ENGAGEMENT_PAGE,
  type EngagementPagePayload,
} from "@/lib/engagement-page-shared";

/**
 * The consolidated key keeps the literal "engagement" prefix, so every existing
 * invalidation of ["engagement"] still reaches this query.
 */
export function engagementPageKey(engagementId: string, profileId: string | undefined) {
  return ["engagement", engagementId, profileId ?? null] as const;
}

type Fetcher = (args: { data: { engagement_id: string; profile_id: string | null } }) => Promise<
  EngagementPagePayload
>;

function pageOptions(engagementId: string, profileId: string | undefined, fetchPage: Fetcher) {
  return {
    queryKey: engagementPageKey(engagementId, profileId),
    queryFn: (): Promise<EngagementPagePayload> =>
      fetchPage({ data: { engagement_id: engagementId, profile_id: profileId ?? null } }),
  };
}

/** The single read the engagement page makes. */
export function useEngagementPage(engagementId: string) {
  const { data: profile } = useProfile();
  const fetchPage = useServerFn(getEngagementPage) as unknown as Fetcher;
  return useQuery({
    ...pageOptions(engagementId, profile?.id, fetchPage),
    enabled: Boolean(engagementId) && Boolean(profile?.id),
  });
}

/**
 * A thin passthrough that keeps an older query key alive while reading from the
 * consolidated payload. Invalidating the old key refetches the payload once;
 * concurrent passthroughs share that single in flight request.
 */
export function useEngagementSlice<T>(
  engagementId: string | undefined,
  key: QueryKey,
  select: (payload: EngagementPagePayload) => T,
  options?: { enabled?: boolean },
) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const fetchPage = useServerFn(getEngagementPage) as unknown as Fetcher;
  return useQuery({
    queryKey: key,
    enabled: Boolean(engagementId) && Boolean(profile?.id) && (options?.enabled ?? true),
    queryFn: async (): Promise<T> => {
      const payload = await queryClient.fetchQuery(
        pageOptions(engagementId as string, profile?.id, fetchPage),
      );
      return select(payload ?? EMPTY_ENGAGEMENT_PAGE);
    },
  });
}
