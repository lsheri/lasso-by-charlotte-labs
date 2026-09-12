import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSettingsDialog } from "@/lib/settings-dialog-context";

function ConnectorsRoute() {
  const { openSettings } = useSettingsDialog();
  const navigate = useNavigate();

  useEffect(() => {
    openSettings("connectors");
    navigate({ to: "/overview", replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export const Route = createFileRoute("/_authenticated/connectors")({
  head: () => ({
    meta: [
      { title: "Connectors | Lasso by Charlotte Labs" },
      { name: "description", content: "Connect the places your work already happens." },
      { property: "og:title", content: "Connectors | Lasso" },
      { property: "og:description", content: "Connect the places your work already happens." },
    ],
  }),
  component: ConnectorsRoute,
});
