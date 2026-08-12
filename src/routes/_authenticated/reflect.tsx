import { createFileRoute } from "@tanstack/react-router";

import { ReflectPage } from "@/pages/ReflectPage";

export const Route = createFileRoute("/_authenticated/reflect")({
  head: () => ({
    meta: [
      { title: "Reflect | Lasso" },
      {
        name: "description",
        content: "A private thinking space over your own recorded work in Lasso.",
      },
      { property: "og:title", content: "Reflect | Lasso" },
      {
        property: "og:description",
        content: "A private thinking space over your own recorded work in Lasso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReflectPage,
});
