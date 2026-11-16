import { createFileRoute } from "@tanstack/react-router";

import { ClientPage } from "@/pages/ClientPage";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "Folder | Lasso" },
      { name: "description", content: "The folders, boards, docs and chats in this folder." },
      { property: "og:title", content: "Folder | Lasso" },
      {
        property: "og:description",
        content: "The folders, boards, docs and chats in this folder.",
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
