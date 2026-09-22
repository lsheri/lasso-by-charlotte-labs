import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useEffect } from "react";
import { z } from "zod";

import { useRecordEngagementView } from "@/hooks/use-engagement-views";
import { CanvasLabPage } from "@/pages/CanvasLabPage";

const canvasLabSearchSchema = z.object({
  from: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/engagements/$id_/canvas-lab")({
  validateSearch: zodValidator(canvasLabSearchSchema),
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
  const { from } = Route.useSearch();
  const navigate = Route.useNavigate();

  // Opening the board records that this person opened it, once per open.
  useRecordEngagementView(id);

  useEffect(() => {
    if (!from) return;
    void navigate({ search: {}, replace: true });
  }, [from, navigate]);

  return <CanvasLabPage engagementId={id} entryVia={from} />;
}
