import { useNavigate } from "@tanstack/react-router";
import type { Profile } from "@/hooks/use-profile";
import { signOut } from "@/lib/sign-out";
import { logEvent } from "@/lib/telemetry";
import { useSettingsDialogOptional } from "@/lib/settings-dialog-context";
import { navFor } from "./nav-config";
import { useNavCtx } from "./use-nav-ctx";
import { OrgSwitcher } from "./OrgSwitcher";
import { WorkspaceMenuItems } from "./WorkspaceMenuItems";

export function WorkspaceMenu({ profiles, active, name, onOpenSettings, onNavigate, surface = "sidebar" }: {
  profiles?: Profile[]; active?: Profile | null; name?: string; onOpenSettings?: (() => void) | undefined;
  onNavigate?: (() => void) | undefined; surface?: "sidebar" | "drawer";
}) {
  const nav = useNavCtx();
  const profile = active ?? nav.profile;
  const settings = useSettingsDialogOptional();
  const navigate = useNavigate();
  const items = navFor(nav.ctx, nav.labels).filter((group) => group.placement === "workspace_menu").flatMap((group) => group.items);
  const opened = (item: (typeof items)[number]["id"] | "workspace", at: "sidebar" | "workspace_menu" | "drawer") => {
    if (profile?.org_id) logEvent("nav.opened", profile.org_id, { item, surface: at });
  };
  return <OrgSwitcher profiles={profiles ?? nav.profiles} active={profile}
    header={<span className="block truncate text-sm font-medium">{name ?? profile?.display_name}</span>}
    onOpen={() => opened("workspace", surface)}>
    <WorkspaceMenuItems dropdown items={items} onOpened={(item) => opened(item, surface === "drawer" ? "drawer" : "workspace_menu")}
      onSettings={() => { if (onOpenSettings) onOpenSettings(); else settings?.openSettings(); }}
      onSignOut={() => void signOut(navigate)} onNavigate={onNavigate} />
  </OrgSwitcher>;
}