import { createFileRoute } from "@tanstack/react-router";

import { EduEngagementsPage } from "@/pages/EduEngagementsPage";

const DESCRIPTION = "Side projects, competitions and research you keep work for in Lasso.";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Projects | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <EduEngagementsPage kind="project" />,
});
