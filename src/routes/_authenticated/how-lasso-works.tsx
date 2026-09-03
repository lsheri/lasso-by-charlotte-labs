import { createFileRoute } from "@tanstack/react-router";

import { HowLassoWorksPage } from "@/pages/HowLassoWorksPage";

export const Route = createFileRoute("/_authenticated/how-lasso-works")({
  head: () => ({
    meta: [
      { title: "How Lasso works | Lasso" },
      {
        name: "description",
        content:
          "A walkthrough of Lasso for your account: the sentence that captures your work, where it lands, and what you choose to share.",
      },
      { property: "og:title", content: "How Lasso works | Lasso" },
      {
        property: "og:description",
        content:
          "A walkthrough of Lasso for your account: the sentence that captures your work, where it lands, and what you choose to share.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowLassoWorksPage,
});
