import { createFileRoute } from "@tanstack/react-router";

import { EngagementPage } from "@/pages/EngagementPage";

export const Route = createFileRoute("/_authenticated/engagements/$id")({
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
  return <EngagementPage engagementId={id} />;
}
