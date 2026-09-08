import { createFileRoute } from "@tanstack/react-router";

import { AssignmentsPage } from "@/pages/AssignmentsPage";

const DESCRIPTION = "Everything you have open in Lasso, grouped by the class or project it sits in.";

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Assignments | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssignmentsPage,
});
