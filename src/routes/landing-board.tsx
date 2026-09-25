import { createFileRoute } from "@tanstack/react-router";

import { LandingBoard } from "@/components/marketing/LandingBoard";

export const Route = createFileRoute("/landing-board")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lasso board story | Private preview" },
      { name: "description", content: "A private preview of the Lasso product story on an invented consulting workspace." },
      { property: "og:title", content: "Lasso board story | Private preview" },
      { property: "og:description", content: "A private preview of the Lasso product story on an invented consulting workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LandingBoard,
});