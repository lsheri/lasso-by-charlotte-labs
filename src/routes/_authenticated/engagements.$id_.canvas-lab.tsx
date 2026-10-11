import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useEffect } from "react";
import { z } from "zod";

import { useQueryClient } from "@tanstack/react-query";

import { canvasLabBoardQuery } from "@/hooks/use-canvas-lab";
import { useRecordEngagementView } from "@/hooks/use-engagement-views";
import { useProfile } from "@/hooks/use-profile";
import { CanvasLabPage } from "@/pages/CanvasLabPage";

const canvasLabSearchSchema = z.object({
  from: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/engagements/$id_/canvas-lab")({
  validateSearch: zodValidator(canvasLabSearchSchema),
  head: () => ({
    meta: [
      { title: "Workboard | Lasso" },
      {
        name: "description",
        content: "A local workboard for understanding the sources, context, judgment, calls, and finished work in one workboard.",
      },
      { property: "og:title", content: "Workboard | Lasso" },
      {
        property: "og:description",
        content: "A local workboard for understanding the sources, context, judgment, calls, and finished work in one workboard.",
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
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const profileId = profile?.id;

  // Opening the board records that this person opened it, once per open.
  useRecordEngagementView(id);

  // PERF-A: direct opens start the board read here; a redirected open finds
  // it already in flight under the same key, so nothing fetches twice.
  useEffect(() => {
    if (!id || !profileId) return;
    void queryClient.prefetchQuery(canvasLabBoardQuery(id, profileId));
  }, [id, profileId, queryClient]);

  useEffect(() => {
    if (!from) return;
    void navigate({ search: {}, replace: true });
  }, [from, navigate]);

  return <CanvasLabPage engagementId={id} entryVia={from} />;
}
