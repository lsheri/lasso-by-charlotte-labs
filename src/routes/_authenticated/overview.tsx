import { Navigate, createFileRoute } from "@tanstack/react-router";

/**
 * PASS A1 — Overview is retired. This path only exists so old links and
 * bookmarks still arrive at the signed-in Home board.
 * The move happens once the shell is up rather than from beforeLoad: thrown
 * mid-hydration under this client-only subtree, that left the screen blank.
 */
export const Route = createFileRoute("/_authenticated/overview")({
  component: () => <Navigate to="/home" replace />,
});
