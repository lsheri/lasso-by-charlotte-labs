import { createFileRoute, redirect } from "@tanstack/react-router";

/** Retired. Old shared links land on the demo. */
export const Route = createFileRoute("/demo/classic")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/demo", replace: true });
  },
  component: () => null,
});
