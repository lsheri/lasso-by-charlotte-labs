import { createFileRoute } from "@tanstack/react-router";

import { requirePartnerWorkspace } from "@/lib/partner-guard";
import { AddingPeoplePage } from "@/pages/AddingPeoplePage";

const DESCRIPTION = "How partner workspaces request seats, invite people, and understand what sponsors can see.";

export const Route = createFileRoute("/_authenticated/adding-people")({
  ssr: false,
  beforeLoad: () => requirePartnerWorkspace(),
  head: () => ({
    meta: [
      { title: "Adding people to Lasso | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Adding people to Lasso | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddingPeoplePage,
});
