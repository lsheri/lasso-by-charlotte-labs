import { createFileRoute, redirect } from "@tanstack/react-router";

import { B2BLanding } from "@/components/marketing/B2BLanding";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Lasso: see where every number in a deliverable came from";
const DESCRIPTION =
  "Lasso keeps the record of AI-assisted consulting work, the sources behind it, and the judgment your people made on top of it.";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (data.user) throw redirect({ to: "/overview" });
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <B2BLanding surface="home" />;
}
