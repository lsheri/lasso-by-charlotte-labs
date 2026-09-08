import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  user_id: string | null;
  org_id: string;
  role: string;
  display_name: string;
  title_band: string | null;
  org_name: string;
  /** "company" for a firm, "edu" for a school workspace, "personal" otherwise. */
  org_type: "company" | "personal" | "edu";

  onboarding: unknown;
  /** When this profile was created. Used for banded age only, never shown. */
  created_at?: string | null;
};


/** Business orgs get the members console; personal ones get "Your coaches". */
export function isBusinessOrg(profile: { org_type: string } | null | undefined): boolean {
  return profile?.org_type === "company";
}

/** Active profiles, plus whether the user holds only deactivated ones. */
export type ProfileState = { profiles: Profile[]; hasDeactivated: boolean };

const STORAGE_KEY = "lasso.active_profile_id";
const listeners = new Set<() => void>();

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveProfileId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage is a convenience, never a requirement */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useActiveProfileId(): string | null {
  return useSyncExternalStore(subscribe, readStored, () => null);
}

/** Every profile this user holds, one per org. */
export async function fetchProfiles(): Promise<Profile[]> {
  return (await fetchProfileState()).profiles;
}

export async function fetchProfileState(): Promise<ProfileState> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { profiles: [], hasDeactivated: false };
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, user_id, org_id, role, display_name, title_band, onboarding, created_at, deactivated_at, orgs(name, settings)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<Profile, "org_name" | "org_type"> & {
    deactivated_at: string | null;
    orgs: { name: string; settings: Record<string, unknown> | null } | null;
  })[];
  // A deactivated profile is simply omitted, the switcher and every query
  // behave as if that workspace isn't there.
  const profiles = rows
    .filter((row) => !row.deactivated_at)
    .map(({ orgs, deactivated_at: _deactivated, ...rest }) => ({
      ...rest,
      org_name: orgs?.name ?? "Workspace",
      org_type: (orgs?.settings?.["type"] === "company"
        ? "company"
        : orgs?.settings?.["type"] === "edu"
          ? "edu"
          : "personal") as "company" | "personal" | "edu",

    }));
  return { profiles, hasDeactivated: rows.some((row) => row.deactivated_at) };
}

function pickActive(profiles: Profile[], activeId: string | null): Profile | null {
  if (profiles.length === 0) return null;
  const match = activeId ? profiles.find((p) => p.id === activeId) : undefined;
  return match ?? (profiles[0] as Profile);
}

/** Existence check used by route gates, true when the user has any profile. */
export async function fetchProfile(): Promise<Profile | null> {
  const profiles = await fetchProfiles();
  return pickActive(profiles, readStored());
}

export function useProfiles() {
  return useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, staleTime: 60_000 });
}

/** The active profile, the only one, or the most recently used. */
export function useProfile() {
  const query = useProfiles();
  const activeId = useActiveProfileId();
  const profiles = query.data ?? [];
  return { ...query, data: pickActive(profiles, activeId), profiles };
}

export const ROLE_LABELS: Record<string, string> = {
  em: "Engagement Mgr",
  coach: "Coach",
  lead: "Lead",
  admin: "Admin",
};
