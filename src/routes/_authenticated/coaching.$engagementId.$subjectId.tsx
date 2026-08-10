import { createFileRoute } from "@tanstack/react-router";

import { PacketPage } from "@/pages/PacketPage";

export const Route = createFileRoute("/_authenticated/coaching/$engagementId/$subjectId")({
  head: () => ({
    meta: [
      { title: "Coaching packet — Lasso" },
      {
        name: "description",
        content: "The shared record behind a coaching conversation: work, decisions, notes.",
      },
      { property: "og:title", content: "Coaching packet — Lasso" },
      {
        property: "og:description",
        content: "The shared record behind a coaching conversation: work, decisions, notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PacketRoute,
});

function PacketRoute() {
  const { engagementId, subjectId } = Route.useParams();
  return <PacketPage engagementId={engagementId} subjectId={subjectId} />;
}
