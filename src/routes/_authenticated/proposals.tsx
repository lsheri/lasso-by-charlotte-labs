import { createFileRoute } from "@tanstack/react-router";

import { deskLinkFromSearch, deskViewFromSearch, type DeskLink, type DeskView } from "@/lib/proposal-desk-shared";
import { ProposalsPage } from "@/pages/ProposalsPage";

const DESCRIPTION = "Every open proposal in your workspace, how long each has left, and what was won.";

export const Route = createFileRoute("/_authenticated/proposals")({
  // A link carries the view to open on, and (21 Nov, D-82, from an admin's Home) the proposal to show, the proposal
  // whose lead sheet to open, or the People tab. Anything else in the address is dropped.
  validateSearch: (search: Record<string, unknown>): { view?: DeskView } & DeskLink => {
    const view = deskViewFromSearch(search["view"]);
    return { ...(view ? { view } : {}), ...deskLinkFromSearch(search) };
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
