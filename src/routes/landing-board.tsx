import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/landing-board")({
  ssr: false,
  beforeLoad: ({ location }) => {
    throw redirect({ to: "/", hash: location.hash.replace(/^#/, "") || undefined, replace: true });
  },
  component: () => null,
});