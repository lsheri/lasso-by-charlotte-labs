import { createFileRoute } from "@tanstack/react-router";

import { DecisionsPage } from "@/pages/DecisionsPage";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({
    meta: [
      { title: "Decision log | Lasso" },
      { name: "description", content: "Decisions you've made, and why." },
      { property: "og:title", content: "Decision log | Lasso" },
      { property: "og:description", content: "Decisions you've made, and why." },
    ],
  }),
  component: DecisionsPage,
});