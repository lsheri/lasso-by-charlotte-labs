import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";

import { useQueryClient } from "@tanstack/react-query";

import { canvasLabBoardQuery } from "@/hooks/use-canvas-lab";
import { useRecordEngagementView } from "@/hooks/use-engagement-views";
import { useRememberBoardOpen } from "@/lib/sidebar-tree-state";
import { useProfile } from "@/hooks/use-profile";
import type { StickyTarget } from "@/components/canvas-lab/useStickyDeepLink";
import { CanvasLabPage } from "@/pages/CanvasLabPage";

const canvasLabSearchSchema = z.object({
  from: fallback(z.string(), "").default(""),
  // S4b-2: a notification names the sticky and its work; the board opens it, then the address is cleaned.
  sticky: fallback(z.string(), "").default(""),
  work: fallback(z.string(), "").default(""),
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
  const { from, sticky, work } = Route.useSearch();
  const [openSticky, setOpenSticky] = useState<StickyTarget | null>(null);
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const profileId = profile?.id;

  // Opening the board records that this person opened it, once per open.
  useRecordEngagementView(id);
  useRememberBoardOpen(profileId, id);

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

  useEffect(() => {
    if (!sticky || !work) return;
    setOpenSticky({ stickyId: sticky, workItemId: work, at: Date.now() });
    void navigate({ search: {}, replace: true });
  }, [sticky, work, navigate]);

  return <CanvasLabPage engagementId={id} entryVia={from} openSticky={openSticky} />;
}
