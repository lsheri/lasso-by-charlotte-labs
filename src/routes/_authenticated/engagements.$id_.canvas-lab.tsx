import { createFileRoute } from "@tanstack/react-router";

import { CanvasLabPage } from "@/pages/CanvasLabPage";

export const Route = createFileRoute("/_authenticated/engagements/$id_/canvas-lab")({
  head: () => ({
    meta: [
      { title: "Engagement Workboard | Lasso" },
      {
        name: "description",
        content: "A local workboard for understanding the sources, context, judgment, calls, and finished work in one engagement.",
      },
      { property: "og:title", content: "Engagement Workboard | Lasso" },
      {
        property: "og:description",
        content: "A local workboard for understanding the sources, context, judgment, calls, and finished work in one engagement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CanvasLabRoute,
});

function CanvasLabRoute() {
  const { id } = Route.useParams();
  return <CanvasLabPage engagementId={id} />;
}
