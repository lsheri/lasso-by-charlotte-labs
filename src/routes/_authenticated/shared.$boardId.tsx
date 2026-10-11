import { createFileRoute } from "@tanstack/react-router";

import { SharedBoardPage } from "@/pages/SharedBoardPage";

export const Route = createFileRoute("/_authenticated/shared/$boardId")({
  head: () => ({
    meta: [
      { title: "A board shared with you | Lasso" },
      { name: "description", content: "Read what one of your people shared with your workspace." },
      { property: "og:title", content: "A board shared with you | Lasso" },
      { property: "og:description", content: "Read what one of your people shared with your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedBoardRoute,
});

function SharedBoardRoute() {
  const { boardId } = Route.useParams();
  return <SharedBoardPage boardId={boardId} />;
}
