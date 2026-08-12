import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/pages/SettingsPage";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Lasso" },
      { name: "description", content: "Naming conventions and workspace preferences for Lasso." },
      { property: "og:title", content: "Settings | Lasso" },
      {
        property: "og:description",
        content: "Naming conventions and workspace preferences for Lasso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});
