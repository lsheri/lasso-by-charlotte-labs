import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSettingsDialog } from "@/lib/settings-dialog-context";

function SettingsRoute() {
  const { openSettings } = useSettingsDialog();
  const navigate = useNavigate();
  const { section } = Route.useSearch();

  useEffect(() => {
    // SH-6d-1: ?section=support (or any section id) lands on that section.
    openSettings(section);
    navigate({ to: "/work", replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>): { section?: string } => {
    const section = search["section"];
    return typeof section === "string" && /^[a-z-]{1,32}$/.test(section) ? { section } : {};
  },
  head: () => ({
    meta: [{ title: "Settings | Lasso" }],
  }),
  component: SettingsRoute,
});
