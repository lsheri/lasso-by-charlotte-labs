import { createFileRoute } from "@tanstack/react-router";

import { ArchivedB2BLanding } from "@/components/marketing/archive/landing-2026-09-25/ArchivedB2BLanding";
import "@/components/marketing/archive/landing-2026-09-25/archive.css";

const TITLE = "Lasso landing, archived 25 Sep 2026";

export const Route = createFileRoute("/_authenticated/archive/landing-2026-09-25")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "robots", content: "noindex,nofollow" },
      { name: "description", content: "An archived copy of the Lasso landing page." },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: "An archived copy of the Lasso landing page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArchivedLandingPage,
});

function ArchivedLandingPage() {
  return (
    <div className="landing-archive-2026-09-25">
      <ArchivedB2BLanding />
    </div>
  );
}
