import { createFileRoute } from "@tanstack/react-router";

import { DemoBoardPage } from "@/pages/DemoPages";

export const Route = createFileRoute("/demo/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "A demo board | Lasso" },
      { name: "description", content: "One read only board from the Lasso demo workspace. Every figure is invented." },
      { property: "og:title", content: "A demo board | Lasso" },
      { property: "og:description", content: "One read only board from the Lasso demo workspace. Every figure is invented." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoBoardRoute,
});

function DemoBoardRoute() {
  const { code } = Route.useParams();
  return <DemoBoardPage code={code} />;
}
