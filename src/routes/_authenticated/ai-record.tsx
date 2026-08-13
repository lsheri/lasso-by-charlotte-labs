import { createFileRoute } from "@tanstack/react-router";

import { AiRecordPage } from "@/pages/AiRecordPage";

export const Route = createFileRoute("/_authenticated/ai-record")({
  head: () => ({
    meta: [
      { title: "AI record | Lasso" },
      {
        name: "description",
        content: "Every AI conversation you have captured, grouped by engagement, in Lasso.",
      },
      { property: "og:title", content: "AI record | Lasso" },
      {
        property: "og:description",
        content: "Every AI conversation you have captured, grouped by engagement, in Lasso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiRecordPage,
});
