import type { Profile } from "@/hooks/use-profile";
import { clientsEnabled } from "@/lib/workspace-settings";

/**
 * The rule the sidebar's New client action uses. A client is canonical and
 * billable, so only an org admin mints or renames one, and only where the
 * workspace uses clients at all. The database refuses anyone else; this only
 * keeps a button that cannot work off the screen. Folders stay open to every
 * member and are not governed here.
 */
export function canCreateClient(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin" && clientsEnabled(profile);
}
