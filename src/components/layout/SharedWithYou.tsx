/**
 * SH-6b: boards other people shared with this person. A board guest lives in
 * the host's workspace as a profile with is_guest, member of one board only.
 * Opening a shared board switches to that guest profile quietly; Back returns
 * to the person's own workspace.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { setActiveProfileId, useProfile, type Profile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";

export const SHARED_WITH_YOU_COPY = {
  title: "Shared with you",
  accept: "Accept",
  open: "Open",
  guestBar: (host: string) => `Shared by ${host}.`,
  back: "Back to your workspace",
  failed: "That board could not be opened. Ask the person who shared it for a new link.",
} as const;

const OWN_PROFILE_KEY = "lasso.last_own_profile";

export type SharedBoardRow = { engagement_id: string; title: string; host_org: string; guest_profile_id: string; level: string; added_at: string };
export type PendingInviteRow = { invite_id: string; code: string; board: string; host_org: string; invited_by: string; level: string; created_at: string };

export function useSharedWithYou(enabled: boolean) {
  const shared = useQuery({
    queryKey: ["my-shared-boards"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_shared_boards");
      if (error) throw error;
      return (data ?? []) as SharedBoardRow[];
    },
  });
  const pending = useQuery({
    queryKey: ["my-pending-board-invites"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_pending_board_invites");
      if (error) throw error;
      return (data ?? []) as PendingInviteRow[];
    },
  });
  return { shared: shared.data ?? [], pending: pending.data ?? [] };
}

/** Switch profile, refresh everything scoped to it, open the board. */
function useOpenAs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async (profileId: string, engagementId: string) => {
    const ok = await setActiveProfileId(profileId);
    if (!ok) return false;
    void queryClient.invalidateQueries();
    void navigate({ to: "/engagements/$id/canvas-lab", params: { id: engagementId } });
    return true;
  };
}

/** Claim a share code, become its guest profile, open the board. */
export function useAcceptBoardShare() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const openAs = useOpenAs();
  return async (code: string, level: string, via: "bell" | "sidebar"): Promise<string | null> => {
    const { data, error } = await supabase.rpc("claim_board_invite", { p_code: code });
    if (error) return SHARED_WITH_YOU_COPY.failed;
    const r = (data ?? {}) as Record<string, unknown>;
    const profileId = typeof r["profile_id"] === "string" ? r["profile_id"] : null;
    const engagementId = typeof r["engagement_id"] === "string" ? r["engagement_id"] : null;
    if (!profileId || !engagementId) return SHARED_WITH_YOU_COPY.failed;
    if (profile?.org_id) logEvent("board.invite_accepted", profile.org_id, { kind: "peer", level, via });
    // The new guest profile has to be in the list before it can be active.
    queryClient.removeQueries({ queryKey: ["profile-state"] });
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    return (await openAs(profileId, engagementId)) ? null : SHARED_WITH_YOU_COPY.failed;
  };
}

/** Sidebar section, shown in every workspace; silent when both lists are empty. */
export function SharedWithYouSection({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { shared, pending } = useSharedWithYou(true);
  const accept = useAcceptBoardShare();
  const openAs = useOpenAs();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (shared.length === 0 && pending.length === 0) return null;
  const row = "flex w-full min-w-0 flex-col rounded-md px-2 py-1 text-left transition-colors hover:bg-secondary";
  return (
    <div data-testid="shared-with-you">
      <div className="nb-group-header nb-shared-ink px-2">{SHARED_WITH_YOU_COPY.title}</div>
      <div className="mt-2 flex flex-col gap-0.5">
        {shared.map((b) => (
          <button
            key={`${b.engagement_id}:${b.guest_profile_id}`}
            type="button"
            className={row}
            onClick={() => {
              onNavigate?.();
              void openAs(b.guest_profile_id, b.engagement_id);
            }}
          >
            <span className="truncate text-[13px] text-foreground">{b.title}</span>
            <span className="truncate text-[11.5px] text-muted-foreground">{b.host_org}</span>
          </button>
        ))}
        {pending.map((p) => (
          <div key={p.invite_id} className="flex items-center gap-2 px-2 py-1">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-foreground">{p.board}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground">{p.host_org}</span>
            </span>
            <button
              type="button"
              disabled={busy === p.invite_id}
              className="nb-pencil-cta shrink-0 rounded-md px-2 py-1 text-[11.5px]"
              onClick={async () => {
                setBusy(p.invite_id);
                setError(null);
                const msg = await accept(p.code, p.level, "sidebar");
                setBusy(null);
                if (msg) setError(msg);
                else onNavigate?.();
              }}
            >
              {SHARED_WITH_YOU_COPY.accept}
            </button>
          </div>
        ))}
        {error && <p className="px-2 text-[11.5px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}

/** Remembers the person's own (non-guest) workspace so Back has somewhere to go. */
export function useRememberOwnProfile(profile: Profile | null | undefined) {
  useEffect(() => {
    if (!profile || profile.is_guest) return;
    try {
      window.localStorage.setItem(OWN_PROFILE_KEY, profile.id);
    } catch {
      /* convenience only */
    }
  }, [profile]);
}

function ownProfileId(profiles: Profile[]): string | null {
  const own = profiles.filter((p) => !p.is_guest);
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(OWN_PROFILE_KEY);
  } catch {
    stored = null;
  }
  if (stored && own.some((p) => p.id === stored)) return stored;
  const latest = [...own].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  return latest?.id ?? null;
}

/** Thin bar over the board while the active profile is a guest. */
export function GuestBar({ profile, profiles }: { profile: Profile; profiles: Profile[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const target = ownProfileId(profiles);
  return (
    <div data-testid="guest-bar" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-card px-3 py-1.5 text-[11.5px] text-muted-foreground">
      <span>{SHARED_WITH_YOU_COPY.guestBar(profile.org_name)}</span>
      {target && (
        <button
          type="button"
          className="text-foreground underline underline-offset-2"
          onClick={async () => {
            if (!(await setActiveProfileId(target))) return;
            void queryClient.invalidateQueries();
            void navigate({ to: "/home" });
          }}
        >
          {SHARED_WITH_YOU_COPY.back}
        </button>
      )}
    </div>
  );
}
