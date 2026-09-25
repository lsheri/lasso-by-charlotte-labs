import { createFileRoute } from "@tanstack/react-router";

import { DemoConversationsPage } from "@/pages/DemoExtraPages";

export const Route = createFileRoute("/demo/conversations")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "All AI Conversations, demo | Lasso" },
      { name: "description", content: "All AI Conversations in the read only Lasso demo workspace. Every figure is invented." },
      { property: "og:title", content: "All AI Conversations, demo | Lasso" },
      { property: "og:description", content: "All AI Conversations in the read only Lasso demo workspace. Every figure is invented." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoConversationsPage,
});
