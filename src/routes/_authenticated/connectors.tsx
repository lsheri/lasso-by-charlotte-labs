import { createFileRoute } from "@tanstack/react-router";

import { ConnectorsPage } from "@/pages/ConnectorsPage";

export const Route = createFileRoute("/_authenticated/connectors")({
  head: () => ({
    meta: [
      { title: "Connectors | Lasso by Charlotte Labs" },
      { name: "description", content: "Connect the places your work already happens." },
      { property: "og:title", content: "Connectors | Lasso" },
      { property: "og:description", content: "Connect the places your work already happens." },
    ],
  }),
  component: ConnectorsPage,
});