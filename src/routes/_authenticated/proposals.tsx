import { createFileRoute } from "@tanstack/react-router";

import { deskViewFromSearch, type DeskView } from "@/lib/proposal-desk-shared";
import { ProposalsPage } from "@/pages/ProposalsPage";

const DESCRIPTION = "Every open proposal in your workspace, how long each has left, and what was won.";

export const Route = createFileRoute("/_authenticated/proposals")({
  // "See all" on Home carries the view that was chosen there. Anything else in the address is dropped.
  validateSearch: (search: Record<string, unknown>): { view?: DeskView } => {
    const view = deskViewFromSearch(search["view"]);
    return view ? { view } : {};
  },
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
