import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useEngagementPage } from "@/hooks/use-engagement-page";
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
      { title: "Engagement | Lasso" },
      { name: "description", content: "Engagement brief, tasks, and the work mapped to them." },
      { property: "og:title", content: "Engagement | Lasso" },
      { property: "og:description", content: "Engagement brief, tasks, and the work mapped to them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EngagementRoute,
});

function EngagementRoute() {
  const { id } = Route.useParams();
  const { work, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const page = useEngagementPage(id);
  const engagement = page.data?.engagement ?? null;
  const sentRef = useRef(false);

  // The board is the default view of an engagement. The details page is still
  // where a workstream ledger, a shared trace or journey link, a quick folder
  // and a phone land.
  useEffect(() => {
    if (sentRef.current || typeof window === "undefined") return;
    if (page.isLoading || !engagement) return;
    const open = shouldOpenWorkboard({
      work,
      view,
      hasTrace: Boolean(readTraceId(window.location.search)),
      hasJourney: Boolean(readJourneyId(window.location.search)),
      isQuickFolder: engagement.clients?.quick_folder === true,
      isNarrow: window.innerWidth < ENGAGEMENT_NARROW_WIDTH,
    });
    if (!open) return;
    sentRef.current = true;
    void navigate({
      to: "/engagements/$id/canvas-lab",
      params: { id },
      search: { from: "default" },
      replace: true,
    });
  }, [engagement, id, navigate, page.isLoading, view, work]);

  return <EngagementPage engagementId={id} />;
}
