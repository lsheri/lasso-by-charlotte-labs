import { createFileRoute } from "@tanstack/react-router";

import { FirmDashboardPage } from "@/pages/FirmDashboardPage";

const DESCRIPTION =
  "Counts and structure for your Lasso workspace: adoption, activity, assurance, coaching, and data health. Never the work itself.";

export const Route = createFileRoute("/_authenticated/firm")({
  head: () => ({
    meta: [
      { title: "Firm view | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Firm view | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FirmDashboardPage,
});
