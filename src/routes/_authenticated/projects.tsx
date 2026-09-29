import { createFileRoute } from "@tanstack/react-router";

import { requireEduWorkspace } from "@/lib/edu-guard";

import { EduEngagementsPage } from "@/pages/EduEngagementsPage";

const DESCRIPTION = "Side workboards, competitions and research you keep work for in Lasso.";

export const Route = createFileRoute("/_authenticated/projects")({
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
  component: () => <EduEngagementsPage kind="project" />,
});
