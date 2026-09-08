import { createFileRoute } from "@tanstack/react-router";

import { PortfolioPage } from "@/pages/PortfolioPage";

const DESCRIPTION = "The work you are proud of, kept private in your own Lasso workspace.";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Portfolio | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortfolioPage,
});
