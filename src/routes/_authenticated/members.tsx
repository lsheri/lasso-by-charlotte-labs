import { createFileRoute } from "@tanstack/react-router";

import { MembersPage } from "@/pages/MembersPage";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members | Lasso" },
      { name: "description", content: "Manage who belongs to your Lasso workspace and the invites still outstanding." },
      { property: "og:title", content: "Members | Lasso" },
      {
        property: "og:description",
        content: "Manage who belongs to your Lasso workspace and the invites still outstanding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MembersPage,
});