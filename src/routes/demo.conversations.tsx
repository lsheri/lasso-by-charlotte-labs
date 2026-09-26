import { createFileRoute } from "@tanstack/react-router";

import { DemoConversationsPage } from "@/pages/DemoExtraPages";

export const Route = createFileRoute("/demo/conversations")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { item?: string; turn?: number; from?: "story" | "demo" } => {
    const rawTurn = Number(search["turn"]);
    const item = typeof search["item"] === "string" ? search["item"].slice(0, 64) : undefined;
    return {
      ...(item ? { item } : {}),
      ...(Number.isInteger(rawTurn) && rawTurn > 0 && rawTurn < 1000 ? { turn: rawTurn } : {}),
      ...(search["from"] === "story" || search["from"] === "demo" ? { from: search["from"] } : {}),
    };
  },
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
