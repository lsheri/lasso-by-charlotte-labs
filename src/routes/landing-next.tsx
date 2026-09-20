import { createFileRoute, redirect } from "@tanstack/react-router";

/** The B2B page now lives at "/". Old shared links keep working. */
export const Route = createFileRoute("/landing-next")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: () => null,
});
