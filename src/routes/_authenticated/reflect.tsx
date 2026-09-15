import { createFileRoute, redirect } from "@tanstack/react-router";

import { ReflectPage } from "@/pages/ReflectPage";

/**
 * PASS A1 — Reflect is retired as a place of its own. Its sessions fold into
 * All AI conversations, so this path forwards there. The page itself is left
 * in the codebase until that merge lands.
 */
export const Route = createFileRoute("/_authenticated/reflect")({
  beforeLoad: () => {
    throw redirect({ to: "/ai-record", search: {}, replace: true });
  },
  component: ReflectPage,
});
