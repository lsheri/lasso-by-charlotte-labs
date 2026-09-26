import { createFileRoute } from "@tanstack/react-router";

import { B2BLanding } from "@/components/marketing/B2BLanding";

const TITLE = "Lasso: the human judgment in your team's AI work, traced";
const DESCRIPTION =
  "Lasso keeps the record of AI-assisted consulting work, the sources behind it, and the judgment your people made on top of it.";

export const Route = createFileRoute("/landing-classic")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://lasso.charlotte-labs.com/landing-classic" },
      { property: "og:image", content: "https://lasso.charlotte-labs.com/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://lasso.charlotte-labs.com/og-image.png" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://lasso.charlotte-labs.com/landing-classic" }],
  }),
  component: LandingClassicPage,
});

function LandingClassicPage() {
  return <B2BLanding surface="landing-classic" />;
}