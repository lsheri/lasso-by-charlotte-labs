import { createFileRoute } from "@tanstack/react-router";

import { CoachingPage } from "@/pages/CoachingPage";

export const Route = createFileRoute("/_authenticated/coaching/")({
  head: () => ({
    meta: [
      { title: "People you coach — Lasso" },
      {
        name: "description",
        content: "The colleagues who have shared their working record with you.",
      },
      { property: "og:title", content: "People you coach — Lasso" },
      {
        property: "og:description",
        content: "The colleagues who have shared their working record with you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachingPage,
});
