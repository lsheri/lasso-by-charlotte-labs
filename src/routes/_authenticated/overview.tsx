import { createFileRoute, redirect } from "@tanstack/react-router";

import { OverviewPage } from "@/pages/OverviewPage";

/**
 * PASS A1 — Overview is retired. Everything it showed now lives on the Inbox,
 * which is where work lands, so this path only exists so old links and
 * bookmarks still arrive somewhere真. The component stays wired for the moment
 * so nothing is lost while the panels settle on their new host.
 */
export const Route = createFileRoute("/_authenticated/overview")({
  beforeLoad: () => {
    throw redirect({ to: "/work", replace: true });
  },
  component: OverviewPage,
});
