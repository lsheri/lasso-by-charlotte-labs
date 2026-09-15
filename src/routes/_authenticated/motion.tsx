import { createFileRoute } from "@tanstack/react-router";

import { MotionPage } from "@/pages/MotionPage";

export const Route = createFileRoute("/_authenticated/motion")({
  head: () => ({
    meta: [
      { title: "Motion | Lasso" },
      {
        name: "description",
        content: "The animated scenes in the app, and where each one renders.",
      },
      { property: "og:title", content: "Motion | Lasso" },
      {
        property: "og:description",
        content: "The animated scenes in the app, and where each one renders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MotionPage,
});
