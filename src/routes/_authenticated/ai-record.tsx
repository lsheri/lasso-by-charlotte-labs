import { createFileRoute } from "@tanstack/react-router";

import { AiRecordPage } from "@/pages/AiRecordPage";

export const Route = createFileRoute("/_authenticated/ai-record")({
  head: () => ({
    meta: [
      { title: "Chat library | Lasso" },
      {
        name: "description",
        content: "Your most valuable AI conversations, kept in one place and ready to reuse.",
      },
      { property: "og:title", content: "Chat library | Lasso" },
      {
        property: "og:description",
        content: "Your most valuable AI conversations, kept in one place and ready to reuse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiRecordPage,
});
