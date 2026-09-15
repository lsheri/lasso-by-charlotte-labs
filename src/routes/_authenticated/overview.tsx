import { Navigate, createFileRoute } from "@tanstack/react-router";

/**
 * PASS A1 — Overview is retired. Everything it showed now lives on the Inbox,
 * so this path only exists so old links and bookmarks still arrive somewhere.
 * The move happens once the shell is up rather than from beforeLoad: thrown
 * mid-hydration under this client-only subtree, that left the screen blank.
 */
export const Route = createFileRoute("/_authenticated/overview")({
  component: () => <Navigate to="/work" replace />,
});
