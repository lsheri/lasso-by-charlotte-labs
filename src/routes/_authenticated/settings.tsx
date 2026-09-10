import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSettingsDialog } from "@/lib/settings-dialog-context";

function SettingsRoute() {
  const { openSettings } = useSettingsDialog();
  const navigate = useNavigate();

  useEffect(() => {
    openSettings();
    navigate({ to: "/overview", replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Settings | Lasso" }],
  }),
  component: SettingsRoute,
});
