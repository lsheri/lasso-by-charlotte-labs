import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "@/pages/OverviewPage";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "Overview | Lasso" },
      { name: "description", content: "A calm view of your recent work." },
      { property: "og:title", content: "Overview | Lasso" },
      { property: "og:description", content: "A calm view of your recent work." },
    ],
  }),
  component: OverviewPage,
});