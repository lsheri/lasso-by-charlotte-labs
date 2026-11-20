import { createFileRoute } from "@tanstack/react-router";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { ExpiredLinkPage } from "@/components/legal/ExpiredLinkPage";

/**
 * 20 Nov 2026: /r/<code> is the address a text may one day carry for one person's part of a proposal. Until those
 * links exist, every one of them lands here: public, no sign-in, no loader, no server call. The code is never read,
 * so every code gets the same page.
 */
export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [{ title: "This link is not active" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <>
      <PublicHeader />
      <ExpiredLinkPage />
    </>
  ),
});
