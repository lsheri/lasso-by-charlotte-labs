import { createFileRoute } from "@tanstack/react-router";

import { OneOnOnePage } from "@/pages/OneOnOnePage";

export const Route = createFileRoute("/_authenticated/one-on-one")({
  head: () => ({
    meta: [
      { title: "1:1 prep — Lasso" },
      { name: "description", content: "Structured context for your next coaching conversation." },
      { property: "og:title", content: "1:1 prep — Lasso" },
      { property: "og:description", content: "Structured context for your next coaching conversation." },
    ],
  }),
  component: OneOnOnePage,
});