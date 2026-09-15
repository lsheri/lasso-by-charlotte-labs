import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * PASS A1 — Overview is retired. Everything it showed now lives on the Inbox,
 * so this path only exists so old links and bookmarks still arrive somewhere.
 * It is a redirect and nothing else: mounting the old page here meant a second
 * navigation could start mid-redirect and leave the screen blank.
 */
export const Route = createFileRoute("/_authenticated/overview")({
  beforeLoad: () => {
    throw redirect({ to: "/work", replace: true });
  },
});
