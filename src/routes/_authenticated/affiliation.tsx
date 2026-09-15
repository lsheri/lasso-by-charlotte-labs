import { createFileRoute } from "@tanstack/react-router";

import { AffiliationPage } from "@/pages/AffiliationPage";

export const Route = createFileRoute("/_authenticated/affiliation")({
  head: () => ({
    meta: [
      { title: "What your school sees | Lasso" },
      {
        name: "description",
        content: "The whole list of what an affiliated school can see, and what stays in your account.",
      },
      { property: "og:title", content: "What your school sees | Lasso" },
      {
        property: "og:description",
        content: "The whole list of what an affiliated school can see, and what stays in your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AffiliationPage,
});
