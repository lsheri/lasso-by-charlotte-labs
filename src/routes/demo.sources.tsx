import { createFileRoute } from "@tanstack/react-router";

import { DemoSourcesPage } from "@/pages/DemoExtraPages";

export const Route = createFileRoute("/demo/sources")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Where work comes from, demo | Lasso" },
      { name: "description", content: "Where work comes from in the read only Lasso demo workspace. Every figure is invented." },
      { property: "og:title", content: "Where work comes from, demo | Lasso" },
      { property: "og:description", content: "Where work comes from in the read only Lasso demo workspace. Every figure is invented." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoSourcesPage,
});
