import { Navigate, createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { canvasLabBoardQuery } from "@/hooks/use-canvas-lab";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useProfile } from "@/hooks/use-profile";
import {
  ENGAGEMENT_NARROW_WIDTH,
  shouldOpenWorkboard,
} from "@/lib/engagement-default-view";
import { readJourneyId } from "@/lib/journey-link";
import { readTraceId } from "@/lib/trace-link";
import { EngagementPage } from "@/pages/EngagementPage";

export const Route = createFileRoute("/_authenticated/engagements/$id")({
  validateSearch: (search): { work?: string | undefined; view?: string | undefined } => ({
    ...(typeof search["work"] === "string" ? { work: search["work"] } : {}),
    ...(typeof search["view"] === "string" ? { view: search["view"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Workboard | Lasso" },
      { name: "description", content: "Workboard brief, tasks, and the work mapped to them." },
      { property: "og:title", content: "Workboard | Lasso" },
      { property: "og:description", content: "Workboard brief, tasks, and the work mapped to them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EngagementRoute,
});

function EngagementRoute() {
  const { id } = Route.useParams();
  const { work, view } = Route.useSearch();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const profileId = profile?.id;

  // PERF-A: download the board's code while the engagement read is in flight.
  useEffect(() => {
    void router.preloadRoute({ to: "/engagements/$id/canvas-lab", params: { id } }).catch(() => undefined);
  }, [id, router]);

  // PERF-A: start the board read (shared cache key with useCanvasLab) the
  // moment the acting profile is known, never awaited.
  useEffect(() => {
    if (!id || !profileId) return;
    void queryClient.prefetchQuery(canvasLabBoardQuery(id, profileId));
  }, [id, profileId, queryClient]);

  const page = useEngagementPage(id);
  const engagement = page.data?.engagement ?? null;

  // The board is the default view of an engagement. The details page is still
  // where a workstream ledger, a shared trace or journey link, a quick folder
  // and a phone land. The decision is made during render so the details page
  // never paints for an opening that immediately redirects; the <Navigate>
  // component below performs the actual navigation, which switches the router
  // to the board route (an imperative navigate from an effect updated the URL
  // without remounting the matched route).
  const openBoard = (() => {
    if (page.isLoading || !engagement) return false;
    if (typeof window === "undefined") return false;
    return shouldOpenWorkboard({
      work,
      view,
      hasTrace: Boolean(readTraceId(window.location.search)),
      hasJourney: Boolean(readJourneyId(window.location.search)),
      isQuickFolder: engagement.clients?.quick_folder === true,
      isNarrow: window.innerWidth < ENGAGEMENT_NARROW_WIDTH,
    });
  })();

  if (openBoard) {
    return (
      <Navigate
        to="/engagements/$id/canvas-lab"
        params={{ id }}
        search={{ from: "default" }}
        replace
      />
    );
  }
  return <EngagementPage engagementId={id} />;
}
