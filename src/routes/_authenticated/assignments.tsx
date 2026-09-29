import { createFileRoute } from "@tanstack/react-router";

import { requireEduWorkspace } from "@/lib/edu-guard";

import { AssignmentsPage } from "@/pages/AssignmentsPage";

const DESCRIPTION = "Everything you have open in Lasso, grouped by the class or workboard it sits in.";

export const Route = createFileRoute("/_authenticated/assignments")({
  beforeLoad: requireEduWorkspace,
  head: () => ({
    meta: [
      { title: "Workboards | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Workboards | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssignmentsPage,
});
