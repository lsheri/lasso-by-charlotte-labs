import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/landing-board")({
  ssr: false,
  beforeLoad: ({ location }) => {
    const hash = location.hash.replace(/^#/, "");
    throw redirect({ to: "/", ...(hash ? { hash } : {}), replace: true });
  },
  component: () => null,
});