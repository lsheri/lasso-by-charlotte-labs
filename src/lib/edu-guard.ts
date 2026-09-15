import { redirect } from "@tanstack/react-router";

import { fetchProfile } from "@/hooks/use-profile";

/**
 * PASS A1 — the class, project, assignment and portfolio pages only mean
 * something in a school workspace. This reads the SAME active profile the
 * sidebar reads, so the guard and the nav can never disagree, and sends
 * anyone else to their Inbox.
 */
export async function requireEduWorkspace(): Promise<void> {
  const profile = await fetchProfile();
  if (profile?.org_type !== "edu") throw redirect({ to: "/work", replace: true });
}
