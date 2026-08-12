import { createFileRoute } from "@tanstack/react-router";

import { WorkPage } from "@/pages/WorkPage";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({
    meta: [
      { title: "All work & mapping | Lasso" },
      { name: "description", content: "Your connected work, mapped to engagements and tasks." },
      { property: "og:title", content: "All work & mapping | Lasso" },
      { property: "og:description", content: "Your connected work, mapped to engagements and tasks." },
    ],
  }),
  component: WorkPage,
});