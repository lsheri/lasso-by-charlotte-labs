import { createFileRoute } from "@tanstack/react-router";

import { PilotSetupPage } from "@/components/founder/PilotSetupPage";

// 20 Nov 2026, Set up a pilot: Charlotte Labs founders only. Both server functions refuse everyone else with 403;
// deliberately linked from nowhere in the app's navigation.
export const Route = createFileRoute("/_authenticated/founder/pilots")({
  head: () => ({
    meta: [
      { title: "Set up a pilot | Lasso" },
      { name: "description", content: "Internal page for setting up pilot workspaces." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PilotSetupPage,
});
