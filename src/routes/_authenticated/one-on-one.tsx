import { createFileRoute } from "@tanstack/react-router";

import { OneOnOnePage } from "@/pages/OneOnOnePage";

export const Route = createFileRoute("/_authenticated/one-on-one")({
  head: () => ({
    meta: [
      { title: "1:1 prep | Lasso" },
      { name: "description", content: "What you want to bring up. Nothing here is sent until you choose to." },
      { property: "og:title", content: "1:1 prep | Lasso" },
      { property: "og:description", content: "What you want to bring up. Nothing here is sent until you choose to." },
    ],
  }),
  component: OneOnOnePage,
});