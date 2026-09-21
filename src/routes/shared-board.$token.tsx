import { createFileRoute } from "@tanstack/react-router";

import { SharedBoardPage } from "@/pages/SharedBoardPage";

export const Route = createFileRoute("/shared-board/$token")({
  // The viewer has no session, and the page resolves its own token client
  // side, so nothing here is rendered ahead of that answer.
  ssr: false,
  head: () => ({
    meta: [
      { title: "A shared board | Lasso" },
      {
        name: "description",
        content: "A read only view of one Lasso board, open for a limited time.",
      },
      { property: "og:title", content: "A shared board | Lasso" },
      {
        property: "og:description",
        content: "A read only view of one Lasso board, open for a limited time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SharedBoardRoute,
});

function SharedBoardRoute() {
  const { token } = Route.useParams();
  return <SharedBoardPage token={token} />;
}
