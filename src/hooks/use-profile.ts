import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { OrgType } from "@/lib/org-type";
import { logEvent } from "@/lib/telemetry";


export type Profile = {
  id: string;
  user_id: string | null;
  org_id: string;
  role: string;
  display_name: string;
  title_band: string | null;
  org_name: string;
  /** "company" for a firm, "edu" for a school workspace, "personal" otherwise. */
  org_type: OrgType;
  /** Whether this workspace uses clients at all. An admin sets it; the
   *  vocabulary does not decide it. */
  clients_enabled: boolean;

  onboarding: unknown;
  /** When this profile was created. Used for banded age only, never shown. */
  created_at?: string | null;
};


/** Business orgs get the members console; personal ones get "Your coaches". */
export function isBusinessOrg(profile: { org_type: string } | null | undefined): boolean {
  // A partner firm has members and runs client engagements, so it takes the business vocabulary. Firm view is decided separately, in canSeeFirmView.
  return profile?.org_type === "company" || profile?.org_type === "partner";
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

/** Shared keys so every consumer waits on one request, not its own. */
export const AUTH_USER_KEY = ["auth-user"] as const;
export const ACTIVE_PROFILE_ROW_KEY = ["active-profile-row"] as const;

/**
 * The query client the app is already using. Registered from useProfiles so
 * the non-React helpers below can read and invalidate the same cache instead
 * of going straight to the network.
 */
let sharedQueryClient: QueryClient | null = null;

/** Per session, not per hook instance: survives a remount during navigation. */
const seededUsers = new Set<string>();


/** One auth listener per page, not per hook instance. */
let authUnsubscribe: (() => void) | null = null;

/**
 * Unit X: an identity change drops the cached identity and profile list, so a
 * value saved before a sign-in can never be served after it. A SIGNED_IN for
 * the same person who is already cached (supabase re-emits it on tab focus)
 * is left alone, so focus does not wipe a good cache.
 */
function handleIdentityChange(event: string, nextUserId: string | null): void {
  if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
  const client = sharedQueryClient;
  if (event === "SIGNED_IN" && client) {
    const cached = client.getQueryData<{ id: string } | null>(AUTH_USER_KEY);
    if (cached && nextUserId && cached.id === nextUserId) return;
  }
  seededUsers.clear();
  if (!client) return;
  client.removeQueries({ queryKey: AUTH_USER_KEY });
  client.removeQueries({ queryKey: ["profiles"] });
}

function subscribeToIdentityChanges(): void {
  if (authUnsubscribe) return;
  const auth = supabase.auth as { onAuthStateChange?: typeof supabase.auth.onAuthStateChange };
  if (typeof auth.onAuthStateChange !== "function") return;
  const { data } = auth.onAuthStateChange((event, session) => {
    handleIdentityChange(event, session?.user?.id ?? null);
  });
  authUnsubscribe = () => data.subscription.unsubscribe();
}

export function registerProfileQueryClient(client: QueryClient): void {
  sharedQueryClient = client;
  subscribeToIdentityChanges();
}

/** Test seam. */
export function resetProfileIdentityState(): void {
  authUnsubscribe?.();
  authUnsubscribe = null;
  sharedQueryClient = null;
  seededUsers.clear();
  lastReconciled = null;
}

/**
 * A missing session is a real "signed out" and is returned as null. Any other
 * error is thrown, so the query fails and retries instead of saving a false
 * "no user" that would make a member look like they have no workspace.
 */
async function fetchAuthUser(): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") return null;
    throw error;
  }
  return data.user ? { id: data.user.id } : null;
}

const authUserOptions = {
  queryKey: AUTH_USER_KEY,
  queryFn: fetchAuthUser,
  staleTime: 60_000,
};

/**
 * One identity read per session. Concurrent callers share the in-flight
 * request through the query client rather than each opening their own.
 */
export async function ensureAuthUser(): Promise<{ id: string } | null> {
  if (sharedQueryClient) return sharedQueryClient.ensureQueryData(authUserOptions);
  return fetchAuthUser();
}

async function fetchStoredActiveProfileId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_active_profile")
    .select("profile_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.profile_id ?? null;
}

/**
 * The choice of workspace has to reach the database, not just this tab: the
 * reads are scoped to it there. MN-1: the database row is the truth, so the
 * row is written FIRST. Only once it is accepted does this tab's cache (and
 * so the label) change; a failed write leaves both exactly as they were.
 * Returns whether the database accepted the choice.
 */
export async function setActiveProfileId(id: string): Promise<boolean> {
  const user = await ensureAuthUser();
  const accepted = await writeActiveProfileRow(id, user?.id ?? null);
  if (!accepted) return false;
  // The cached row moves with the write, so reconciliation never sees the
  // old row against the new cache and switches the person straight back.
  if (user) sharedQueryClient?.setQueryData([...ACTIVE_PROFILE_ROW_KEY, user.id], id);
  writeStored(id);
  // The switch is the moment the stored choice changes, so the cached copy is
  // dropped here rather than left to expire. The next read returns the new one.
  sharedQueryClient?.invalidateQueries({ queryKey: ACTIVE_PROFILE_ROW_KEY });
  return true;
}

/** This tab's cache of the choice. Storage is a convenience, never a requirement. */
function writeStored(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage is a convenience, never a requirement */
  }
  for (const listener of listeners) listener();
}

async function writeActiveProfileRow(id: string, userId: string | null): Promise<boolean> {
  try {
    if (!userId) return false;
    const { error } = await supabase
      .from("user_active_profile")
      .upsert(
        { user_id: userId, profile_id: id, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return true;
  } catch {
    // Wrong reads that look right are the dangerous kind, so this is said out
    // loud rather than swallowed.
    toast.error(
      "We could not save which workspace you are in. You may see work from another workspace until you try again.",
    );
    return false;
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
  const user = await ensureAuthUser();
  if (!user) return { profiles: [], hasDeactivated: false };

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, user_id, org_id, role, display_name, title_band, onboarding, created_at, deactivated_at, orgs(name, settings, clients_enabled)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<Profile, "org_name" | "org_type" | "clients_enabled"> & {
    deactivated_at: string | null;
    orgs: { name: string; settings: Record<string, unknown> | null; clients_enabled?: boolean | null } | null;
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
          : orgs?.settings?.["type"] === "partner"
            ? "partner"
            : "personal") as OrgType,
      // NOT NULL in the database; a non-boolean means the row failed to load.
      clients_enabled: orgs?.clients_enabled === true,

    }));
  return { profiles, hasDeactivated: rows.some((row) => row.deactivated_at) };
}

function pickActive(profiles: Profile[], activeId: string | null, rowId?: string | null): Profile | null {
  if (profiles.length === 0) return null;
  // MN-1: the database row wins whenever it names one of these profiles.
  const fromRow = rowId ? profiles.find((p) => p.id === rowId) : undefined;
  if (fromRow) return fromRow;
  const match = activeId ? profiles.find((p) => p.id === activeId) : undefined;
  return match ?? (profiles[0] as Profile);
}

/** MN-1: the last row/cache disagreement already repaired, so it never loops. */
let lastReconciled: string | null = null;

/**
 * When the loaded row names a real profile and this tab's cache says
 * otherwise, the cache follows the row. Never writes the database.
 */
function useReconcileActiveProfile(
  rowProfile: Profile | null,
  localId: string | null,
): void {
  useEffect(() => {
    if (!rowProfile || rowProfile.id === localId) return;
    // An empty cache is not a disagreement: nothing was shown from it, so it
    // simply takes the row's id, with no refetch and no event.
    if (!localId) {
      writeStored(rowProfile.id);
      return;
    }
    const key = `${rowProfile.id}|${localId ?? ""}`;
    if (lastReconciled === key) return;
    lastReconciled = key;
    writeStored(rowProfile.id);
    void sharedQueryClient?.invalidateQueries();
    logEvent("profile.active_reconciled", rowProfile.org_id, { source: "row_differs" });
  }, [rowProfile, localId]);
}

/** Existence check used by route gates, true when the user has any profile. */
export async function fetchProfile(): Promise<Profile | null> {
  const profiles = await fetchProfiles();
  return pickActive(profiles, readStored());
}

export function useProfiles() {
  return useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, staleTime: 60_000 });
}

/** The signed-in user, read once per session however many consumers ask. */
export function useAuthUser() {
  return useQuery(authUserOptions);
}

/** The stored workspace choice, read through the cache, one request for all. */
export function useStoredActiveProfileId(userId: string | null) {
  return useQuery({
    queryKey: [...ACTIVE_PROFILE_ROW_KEY, userId ?? "none"],
    queryFn: () => fetchStoredActiveProfileId(userId as string),
    enabled: Boolean(userId),
    // MN-1: another tab or device may have switched; focus re-asks the row.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Someone who has never switched has no row, so the database falls back to
 * showing every workspace they belong to. Safe, but not what they expect, so
 * the first resolved choice is written once. An existing row is never
 * overwritten here: only an explicit switch does that. The guard lives at
 * module scope, so the hundredth consumer and a remount during navigation do
 * not repeat the first one's write.
 */
function useSeedActiveProfile(
  active: Profile | null,
  userId: string | null,
  storedId: string | null | undefined,
  storedResolved: boolean,
): void {
  useEffect(() => {
    if (!active || !userId || !storedResolved) return;
    if (storedId) return;
    if (seededUsers.has(userId)) return;
    seededUsers.add(userId);
    void writeActiveProfileRow(active.id, userId).then(() => {
      sharedQueryClient?.invalidateQueries({ queryKey: ACTIVE_PROFILE_ROW_KEY });
    });
  }, [active, userId, storedId, storedResolved]);
}

/** The active profile, the only one, or the most recently used. */
export function useProfile() {
  const query = useProfiles();
  const activeId = useActiveProfileId();
  const userQuery = useAuthUser();
  const userId = userQuery.data?.id ?? null;
  const storedQuery = useStoredActiveProfileId(userId);
  const profiles = query.data ?? [];
  const rowId = storedQuery.isSuccess ? storedQuery.data : null;
  const rowProfile = rowId ? profiles.find((p) => p.id === rowId) ?? null : null;
  const active = pickActive(profiles, activeId, rowId);
  useReconcileActiveProfile(rowProfile, activeId);
  useSeedActiveProfile(
    active,
    userId,
    storedQuery.data,
    Boolean(userId) && !storedQuery.isPending && !storedQuery.isError,
  );
  return { ...query, data: active, profiles };
}


export const ROLE_LABELS: Record<string, string> = {
  em: "Engagement Mgr",
  coach: "Coach",
  lead: "Lead",
  admin: "Admin",
};
