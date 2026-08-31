import { createFileRoute } from "@tanstack/react-router";

import { ArchivePage } from "@/pages/ArchivePage";

const DESCRIPTION =
  "Shipped work from across the firm in Lasso. Open anything to walk the process behind it.";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({
    meta: [
      { title: "Past work | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Past work | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArchivePage,
});
