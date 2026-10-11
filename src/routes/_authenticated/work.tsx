import { createFileRoute } from "@tanstack/react-router";

import { WorkPage } from "@/pages/WorkPage";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({
    meta: [
      { title: "All work | Lasso" },
      { name: "description", content: "Your connected work, mapped to workboards and tasks." },
      { property: "og:title", content: "All work | Lasso" },
      { property: "og:description", content: "Your connected work, mapped to workboards and tasks." },
    ],
  }),
  component: WorkPage,
});