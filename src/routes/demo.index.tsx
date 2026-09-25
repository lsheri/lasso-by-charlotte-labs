import { createFileRoute } from "@tanstack/react-router";

import { DemoHomePage } from "@/pages/DemoPages";

export const Route = createFileRoute("/demo/")({
  head: () => ({
    meta: [
      { title: "Demo workspace | Lasso" },
      { name: "description", content: "A read only Lasso demo workspace. Every figure is invented." },
      { property: "og:title", content: "Demo workspace | Lasso" },
      { property: "og:description", content: "A read only Lasso demo workspace. Every figure is invented." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoHomePage,
});
