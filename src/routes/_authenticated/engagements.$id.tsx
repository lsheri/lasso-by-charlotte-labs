import { Navigate, createFileRoute } from "@tanstack/react-router";


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
  // and a phone land. The decision is made during render so the details page
  // never paints for an opening that immediately redirects; the effect below
  // performs the actual navigation.
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

  useEffect(() => {
    if (sentRef.current || typeof window === "undefined") return;
    if (!openBoard) return;
    sentRef.current = true;
    void navigate({
      to: "/engagements/$id/canvas-lab",
      params: { id },
      search: { from: "default" },
      replace: true,
    });
  }, [engagement, id, navigate, openBoard, page.isLoading, view, work]);

  if (openBoard) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  return <EngagementPage engagementId={id} />;
}
