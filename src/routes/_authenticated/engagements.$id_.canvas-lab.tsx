import { createFileRoute } from "@tanstack/react-router";

import { CanvasLabPage } from "@/pages/CanvasLabPage";

export const Route = createFileRoute("/_authenticated/engagements/$id_/canvas-lab")({
  head: () => ({
    meta: [
      { title: "Canvas Lab | Lasso" },
      {
        name: "description",
        content: "An experimental working surface for one engagement. Nothing here is saved.",
      },
      { property: "og:title", content: "Canvas Lab | Lasso" },
      {
        property: "og:description",
        content: "An experimental working surface for one engagement. Nothing here is saved.",
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
