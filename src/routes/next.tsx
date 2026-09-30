import { createFileRoute, redirect } from "@tanstack/react-router";

/** Retired. Old shared links land on the home page. */
export const Route = createFileRoute("/next")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: () => null,
});
