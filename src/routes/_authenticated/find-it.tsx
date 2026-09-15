import { createFileRoute } from "@tanstack/react-router";

import { FindItPage } from "@/pages/FindItPage";

export const Route = createFileRoute("/_authenticated/find-it")({
  head: () => ({
    meta: [
      { title: "Find it | Lasso" },
      {
        name: "description",
        content:
          "Point at a finished piece of work and look back through your conversations for the ones that fed it.",
      },
      { property: "og:title", content: "Find it | Lasso" },
      {
        property: "og:description",
        content:
          "Point at a finished piece of work and look back through your conversations for the ones that fed it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FindItPage,
});
