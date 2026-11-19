import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";
import { termsOfUse } from "@/components/legal/legal-copy";

// 19 Nov 2026: public, no sign-in. The words live in legal-copy.ts and name the product Lasso in every look.
const DOC = termsOfUse();

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Lasso terms of use" },
      { name: "description", content: DOC.description },
      { property: "og:title", content: "Lasso terms of use" },
      { property: "og:description", content: DOC.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage doc={DOC} current="/terms" />,
});
