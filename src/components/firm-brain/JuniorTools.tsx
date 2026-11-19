import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { canAskTheFirm } from "@/lib/firm-ask-shared";
import { getFirmJuniorTags } from "@/lib/firm-junior.functions";

import { HowWeDoThis } from "./HowWeDoThis";
import { PrepareMe } from "./PrepareMe";

type JuniorProfile = {
  id?: string | null;
  role?: string | null;
  has_firm_view?: boolean | null;
  org_type?: string | null;
};

/**
 * 18 Nov, Firm Brain Build Spec step 7: the junior tools on Home, next to Ask the firm, with the same rule for who
 * sees them: company-brain on, a company workspace, not a coach. The server checks again and refuses guests, and then
 * this goes away. It loads the one list both tools pick from (tag keys and counts, read fresh each time Home opens).
 * Only on signed-in Home: never on shared, demo, tour, firm or rollup surfaces.
 */
export function JuniorTools({ profile }: { profile: JuniorProfile | null | undefined }) {
  const flagOn = useFeatureFlag("company-brain");
  const allowed = canAskTheFirm(flagOn, profile);
  const load = useServerFn(getFirmJuniorTags);
  const query = useQuery({
    queryKey: ["firm-junior-tags", profile?.id ?? null],
    enabled: allowed,
    // Read fresh whenever Home opens, so a board with sharing turned off is gone from the lists.
    staleTime: 0,
    retry: false,
    queryFn: () => load({ data: { profile_id: profile?.id ?? null } }),
  });

  if (!allowed) return null;
  if (query.error instanceof Response && query.error.status === 403) return null;

  return (
    <div data-testid="junior-tools" className="mx-4 mt-4 grid gap-4 md:mx-6 lg:grid-cols-2">
      <HowWeDoThis
        tags={query.data}
        loading={query.isLoading}
        failed={query.isError}
        onRetry={() => void query.refetch()}
        profileId={profile?.id}
      />
      <PrepareMe
        tags={query.data}
        loading={query.isLoading}
        failed={query.isError}
        profileId={profile?.id}
      />
    </div>
  );
}
