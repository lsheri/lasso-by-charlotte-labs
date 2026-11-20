import { createFileRoute } from "@tanstack/react-router";

import { FirmBrainPage } from "@/pages/FirmBrainPage";

const DESCRIPTION = "Ask what your firm has done before, and see how it was done.";

export const Route = createFileRoute("/_authenticated/firm-brain")({
  head: () => ({
    meta: [
      { title: "Firm brain | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Firm brain | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FirmBrainPage,
});
