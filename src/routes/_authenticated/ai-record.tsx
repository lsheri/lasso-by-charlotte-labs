import { createFileRoute } from "@tanstack/react-router";

import { AiRecordPage } from "@/pages/AiRecordPage";

export const Route = createFileRoute("/_authenticated/ai-record")({
  // ?ask=1 opens the composer straight away, so anything that offers Ask Lasso
  // without its own panel lands somewhere that can actually answer.
  validateSearch: (search: Record<string, unknown>): { ask?: boolean | undefined; view?: "asked" | undefined } => {
    const on = search["ask"] === "1" || search["ask"] === 1 || search["ask"] === true;
    const view = search["view"] === "asked" ? "asked" as const : undefined;
    return { ...(on ? { ask: true } : {}), ...(view ? { view } : {}) };
  },
  head: () => ({
    meta: [
      { title: "All AI Conversations | Lasso" },
      {
        name: "description",
        content: "Your most valuable AI conversations, kept in one place and ready to reuse.",
      },
      { property: "og:title", content: "All AI Conversations | Lasso" },
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
