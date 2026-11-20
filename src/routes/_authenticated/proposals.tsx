import { createFileRoute } from "@tanstack/react-router";

import { ProposalsPage } from "@/pages/ProposalsPage";

const DESCRIPTION = "Every open proposal in your workspace, how long each has left, and what was won.";

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({
    meta: [
      { title: "Proposals | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Proposals | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalsPage,
});
