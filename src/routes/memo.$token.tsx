import { createFileRoute } from "@tanstack/react-router";
import { MemoPage } from "@/pages/MemoPage";

export const Route = createFileRoute("/memo/$token")({
  head: () => ({ meta: [
    { title: "Shared decisions memo | Lasso" },
    { name: "description", content: "A shared Decisions document from Lasso." },
    { property: "og:title", content: "Shared decisions memo | Lasso" },
    { property: "og:description", content: "A shared Decisions document from Lasso." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: MemoRoute,
});

function MemoRoute() {
  const { token } = Route.useParams();
  return <MemoPage token={token} />;
}