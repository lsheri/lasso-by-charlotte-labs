import { createFileRoute } from "@tanstack/react-router";

import { AiCostsPage } from "@/components/founder/AiCostsPage";

// 18 Nov 2026, founder AI costs: Charlotte Labs staff only. The server function refuses everyone else with 403;
// deliberately linked from nowhere in the app's navigation.
export const Route = createFileRoute("/_authenticated/founder/costs")({
  head: () => ({
    meta: [
      { title: "AI costs | Lasso" },
      { name: "description", content: "Internal page for AI cost accounting." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AiCostsPage,
});
