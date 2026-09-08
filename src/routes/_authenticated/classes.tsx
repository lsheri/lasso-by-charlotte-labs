import { createFileRoute } from "@tanstack/react-router";

import { EduEngagementsPage } from "@/pages/EduEngagementsPage";

const DESCRIPTION = "Every class you are keeping work for in Lasso, this term and the ones before.";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [
      { title: "Classes | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Classes | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <EduEngagementsPage kind="class" />,
});
