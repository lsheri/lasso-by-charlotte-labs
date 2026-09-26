import { createFileRoute } from "@tanstack/react-router";

import { DemoHomePage } from "@/pages/DemoPages";

export const Route = createFileRoute("/demo/classic")({
  head: () => ({
    meta: [
      { title: "Classic demo workspace | Lasso" },
      { name: "description", content: "The original read only Lasso demo workspace. Every figure is invented." },
      { property: "og:title", content: "Classic demo workspace | Lasso" },
      { property: "og:description", content: "The original read only Lasso demo workspace. Every figure is invented." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoHomePage,
});