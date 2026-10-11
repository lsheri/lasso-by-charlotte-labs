import type { Profile } from "@/hooks/use-profile";
import { canManageMembers } from "@/lib/role-access";
import { clientsEnabled } from "@/lib/workspace-settings";

/** The rule the sidebar's New client action has always used. */
export function canCreateClient(profile: Profile | null | undefined): boolean {
  return clientsEnabled(profile) && canManageMembers(profile);
}
