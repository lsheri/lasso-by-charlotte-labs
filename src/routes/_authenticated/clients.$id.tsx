import { createFileRoute } from "@tanstack/react-router";

import { ClientPage } from "@/pages/ClientPage";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "Client | Lasso" },
      { name: "description", content: "Everything claimed to this client, placed or not." },
      { property: "og:title", content: "Client | Lasso" },
      {
        property: "og:description",
        content: "Everything claimed to this client, placed or not.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientRoute,
});

function ClientRoute() {
  const { id } = Route.useParams();
  return <ClientPage clientId={id} />;
}
