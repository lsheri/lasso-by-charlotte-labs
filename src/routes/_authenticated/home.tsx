import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/pages/HomePage";

const TITLE = "Home | Lasso";
const DESCRIPTION = "Your Lasso home for starting engagements and returning to past work.";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});