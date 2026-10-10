import { redirect } from "@tanstack/react-router";

import { fetchProfile, type Profile } from "@/hooks/use-profile";

/**
 * The workshop key requests page only means something in a partner
 * workspace. Mirrors edu-guard: reads the SAME active profile the sidebar
 * reads (unless one is handed in), and sends anyone else to their Inbox.
 */
export async function requirePartnerWorkspace(profile?: Profile | null): Promise<void> {
  const active = profile === undefined ? await fetchProfile() : profile;
  if (active?.org_type !== "partner") throw redirect({ to: "/work", replace: true });
}

/**
 * RQ-1: the workshop key requests page. Everything requirePartnerWorkspace
 * checks, plus the person must be an admin or lead of that workspace.
 * Refusal goes to the same place.
 */
export async function requirePartnerSubmitter(profile?: Profile | null): Promise<void> {
  const active = profile === undefined ? await fetchProfile() : profile;
  if (active?.org_type !== "partner" || (active.role !== "admin" && active.role !== "lead")) {
    throw redirect({ to: "/work", replace: true });
  }
}
