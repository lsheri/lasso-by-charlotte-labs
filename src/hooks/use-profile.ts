import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

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

/**
 * The choice of workspace has to reach the database, not just this tab: the
 * reads are scoped to it there. The local switch happens first and always, so
 * a failed write never leaves the person stuck.
 */
export async function setActiveProfileId(id: string): Promise<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage is a convenience, never a requirement */
  }
  for (const listener of listeners) listener();
  await writeActiveProfileRow(id);
}

async function writeActiveProfileRow(id: string): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from("user_active_profile")
      .upsert(
        { user_id: userId, profile_id: id, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  } catch {
    // Wrong reads that look right are the dangerous kind, so this is said out
    // loud rather than swallowed.
    toast.error(
      "We could not save which workspace you are in. You may see work from another workspace until you try again.",
    );
  }
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

/**
 * Someone who has never switched has no row, so the database falls back to
 * showing every workspace they belong to. Safe, but not what they expect, so
 * the first resolved choice is written once. An existing row is never
 * overwritten here: only an explicit switch does that.
 */
function useSeedActiveProfile(active: Profile | null): void {
  const seeded = useRef(false);
  useEffect(() => {
    if (!active || seeded.current) return;
    seeded.current = true;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        seeded.current = false;
        return;
      }
      const { data: existing, error } = await supabase
        .from("user_active_profile")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || existing) return;
      await writeActiveProfileRow(active.id);
    })();
  }, [active]);
}

/** The active profile, the only one, or the most recently used. */
export function useProfile() {
  const query = useProfiles();
  const activeId = useActiveProfileId();
  const profiles = query.data ?? [];
  const active = pickActive(profiles, activeId);
  useSeedActiveProfile(active);
  return { ...query, data: active, profiles };
}

export const ROLE_LABELS: Record<string, string> = {
  em: "Engagement Mgr",
  coach: "Coach",
  lead: "Lead",
  admin: "Admin",
};
