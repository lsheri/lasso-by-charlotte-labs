import { createFileRoute } from "@tanstack/react-router";

import { CoachNotesPage } from "@/pages/CoachNotesPage";

export const Route = createFileRoute("/_authenticated/coach-notes")({
  head: () => ({
    meta: [
      { title: "Notes about your work | Lasso" },
      {
        name: "description",
        content: "What your coaches wrote about your work, in one place, newest first.",
      },
      { property: "og:title", content: "Notes about your work | Lasso" },
      {
        property: "og:description",
        content: "What your coaches wrote about your work, in one place, newest first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachNotesPage,
});
