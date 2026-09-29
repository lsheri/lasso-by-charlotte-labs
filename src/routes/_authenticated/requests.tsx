import { createFileRoute } from "@tanstack/react-router";

import { requirePartnerWorkspace } from "@/lib/partner-guard";
import { KeyRequestsPage } from "@/pages/KeyRequestsPage";

const DESCRIPTION = "Ask Lasso for workshop keys and collect the links once they are ready.";

export const Route = createFileRoute("/_authenticated/requests")({
  ssr: false,
  beforeLoad: () => requirePartnerWorkspace(),
  head: () => ({
    meta: [
      { title: "Workshop keys | Lasso" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Workshop keys | Lasso" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KeyRequestsPage,
});
