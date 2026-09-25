import { createFileRoute, redirect } from "@tanstack/react-router";

import { ArchivedB2BLanding } from "@/components/marketing/archive/landing-2026-09-25/ArchivedB2BLanding";
import { supabase } from "@/integrations/supabase/client";
import "@/components/marketing/archive/landing-2026-09-25/archive.css";

const TITLE = "Lasso landing, archived 25 Sep 2026";

export const Route = createFileRoute("/landing-archive/2026-09-25")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (!data.user) throw redirect({ to: "/auth" });
  },
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
