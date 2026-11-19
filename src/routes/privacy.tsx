import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";
import { privacyPolicy } from "@/components/legal/legal-copy";

// 19 Nov 2026: public, no sign-in. The words live in legal-copy.ts and name the product Lasso in every look.
const DOC = privacyPolicy();

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Lasso privacy policy" },
      { name: "description", content: DOC.description },
      { property: "og:title", content: "Lasso privacy policy" },
      { property: "og:description", content: DOC.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage doc={DOC} current="/privacy" />,
});
